import * as dotenv from 'dotenv'
import { v4 } from 'uuid'
import type { CONFIG } from './interfaces/config'
dotenv.config()
const config = process.env as unknown as CONFIG
import axios from 'axios'
import * as mysql from 'mysql2/promise'
import knex from 'knex'
import genKey from './genKey'
import { getFirestore } from 'firebase-admin/firestore'
import admin from 'firebase-admin'
if (admin.apps.length === 0) {
	admin.initializeApp({
		credential: admin.credential.cert({
			projectId: config.FIREBASE_PROJECT_ID,
			clientEmail: config.FIREBASE_CLIENT_EMAIL,
			privateKey: config.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
		})
	})
}
const db = getFirestore()
interface IBody {
	domain: string
	at: string
	token: string
	platform: 'ios' | 'android' | 'expo'
}

export default async (body: IBody) => {
	const key = genKey()
	const uuid = v4()
	const { domain, at, token, platform } = body
	const param = {
		subscription: {
			endpoint: `${config.ENDPOINT}/hook/${uuid}`,
			keys: {
				p256dh: key.publicKey,
				auth: key.auth
			}
		},
		data: {
			alerts: {
				poll: true,
				follow: true,
				favourite: true,
				reblog: true,
				mention: true
			}
		}
	}
	try {
		const r = await axios.delete(`https://${domain}/api/v1/push/subscription`, {
			headers: {
				Authorization: `Bearer ${at}`,
				'content-type': 'application/json'
			}
		})
		const a = await axios.post(`https://${domain}/api/v1/push/subscription`, param, {
			headers: {
				Authorization: `Bearer ${at}`,
				'content-type': 'application/json'
			}
		})
		const data = a.data as any
		const serverKey = data.server_key
		const add: any = {
			token,
			serverKey,
			platform,
			publicKey: key.publicKey,
			privateKey: key.privateKey,
			auth: key.auth,
			domain
		}
		await db.collection('subscription').doc(uuid).set(add)
		return true
	} catch (e) {
		console.error(e)
		return false
	}
}
