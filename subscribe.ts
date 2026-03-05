import * as dotenv from 'dotenv'
import { v4 } from 'uuid'
import type { CONFIG } from './interfaces/config'
dotenv.config()
const config = process.env as unknown as CONFIG
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
interface IPreBody {
	domain: string
	token: string
	platform: 'ios' | 'android' | 'expo'
}

export const pre = async (body: IPreBody) => {
	try {
		const key = genKey()
		const uuid = v4()
		const { domain, token, platform } = body
		const param = {
			id: uuid,
			subscription: {
				endpoint: `${config.ENDPOINT}/hook/${uuid}`,
				keys: {
					p256dh: key.publicKey,
					auth: key.auth
				}
			}
		}
		const add: any = {
			token,
			serverKey: '[pending]',
			platform,
			publicKey: key.publicKey,
			privateKey: key.privateKey,
			auth: key.auth,
			domain
		}
		await db.collection('subscription').doc(uuid).set(add)
		return param
	} catch (e) {
		console.error(e)
		return false
	}
}
interface ISubBody {
	id: string
	serverKey: string
}
export const subscribe = async (body: ISubBody) => {
	try {
		const { id, serverKey } = body
		await db.collection('subscription').doc(id).update({
			serverKey
		})
		return true
	} catch (e) {
		console.error(e)
		return false
	}
}
