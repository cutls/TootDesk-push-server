import * as dotenv from 'dotenv'
import { v4 } from 'uuid'
import type { CONFIG } from './interfaces/config'
dotenv.config()
const config = process.env as unknown as CONFIG
import axios from 'axios'
import * as mysql from 'mysql2/promise'
import knex from 'knex'
import genKey from './genKey'
const dbConfig = {
	host: config.DB_HOST,
	user: config.DB_USER,
	password: config.DB_PASSWORD,
	database: config.DB_DATABASE
}
const pool = mysql.createPool(dbConfig)
const my = knex({ client: 'mysql' })
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
		const sql = my(config.DB_TABLE)
			.insert({
				uuid,
				token,
				serverKey: '[pending]',
				platform,
				publicKey: key.publicKey,
				privateKey: key.privateKey,
				auth: key.auth,
				domain
			})
			.toString()
		await pool.query(sql)
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
		const sql = my(config.DB_TABLE)
			.update({
				serverKey
			})
			.where('id', id)
			.toString()
		await pool.query(sql)
		return true
	} catch (e) {
		console.error(e)
		return false
	}
}
