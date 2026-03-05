import * as dotenv from 'dotenv'
import type { CONFIG } from './interfaces/config'
import type { DB } from './interfaces/db'
dotenv.config()
const config = process.env as unknown as CONFIG
import moment from 'moment-timezone'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import http2 from 'http2'
export default async function notify(data: any, db: DB) {
	if (db.platform === 'ios') {
		sendToiOS(db.token, data.title ? data.title : db.domain, data.body ? data.body : data.title, 0, data.data)
	} else if (db.platform === 'expo') {
		await axios.post(`https://expo.io/--/api/v2/push/send`, {
			to: db.token,
			title: data.title ? data.title : db.domain,
			body: data.body ? data.body : data.title,
			data: {
				domain: db.domain,
				...data
			}
		})
	}
}
/*
async function sendToAndroid(token: string | string[], title: string, message: string, customData?: any) {
    try {
        const payload = {
            priority: 'high',
            data: {
                experienceId: '@cutls/we-tips',
                title,
                message,
                body: customData
            },
        } as any
        if (typeof token === 'string') {
            payload.to = token
        } else {
            payload.registration_ids = token
        }
        //console.log(payload)
        const data = await axios.post(`https://fcm.googleapis.com/fcm/send`,
            JSON.stringify(payload),
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `key=${config.FIREBASE_SERVERKEY}`,
                }
            }
        )
        //console.log(`android notf requested to ${typeof token === 'string' ? token.substr(0, 10) : token.map((a) => { return a.substr(0, 10) }).join(',')}`)
        if (!data.data.success) //console.log(data.data)
    } catch (e) {
        console.error(moment().unix(), e)
    }

}
*/
export async function sendToiOS(token: string | string[], title: string, message: string, badge: number, customData?: any) {
	const useToken = typeof token === 'string' ? [token] : token
	const p8 = Buffer.from(config.APN_P8, 'base64').toString()
	const authorizationToken = jwt.sign(
		{
			iss: config.APN_ISS,
			iat: Math.round(new Date().getTime() / 1000)
		},
		p8,
		{
			header: {
				alg: 'ES256',
				kid: config.APN_KID
			}
		}
	)
	const client = http2.connect('https://api.push.apple.com')

	const request = client.request({
		':method': 'POST',
		':scheme': 'https',
		'apns-priority': 10,
		'apns-expiration': moment().add(1, 'day').unix(),
		'apns-topic': config.APN_TOPIC,
		':path': `/3/device/${token}`,
		authorization: `bearer ${authorizationToken}`
	})
	//console.log(`ios notf requested to ${token}`)

	request.setEncoding('utf8')
	const body = {
		aps: {
			alert: {
				title,
				body: message
			}
		},
		body: { customData },
		experienceId: config.APN_EXPERIENCE_ID
	} as any
	if (badge) body.aps.badge = badge
	//console.log(body)
	for (const thisToken of useToken) {
		request.write(JSON.stringify(body))
	}

	request.on('response', (headers, flags) => {
		for (const name in headers) {
			//console.log('response', `${name}: ${headers[name]}`)
		}
	})

	let data = ''
	request.on('data', (chunk) => {
		data += chunk
	})

	request.on('end', () => {
		//console.log('end', `\n${data}`)
		client.close()
	})

	request.end()
}
