/*
    tateisu payload decode
    https://gist.github.com/tateisu/685eab242549d9c9ffc85020f09a4b71
*/
import crypto from 'crypto'
import * as dotenv from 'dotenv'
import axios from 'axios'
import * as mysql from 'mysql2/promise'
import { CONFIG } from './interfaces/config'
import knex from 'knex'
import { DB } from './interfaces/db'
const my = knex({ client: 'mysql' })

dotenv.config()
const config = (process.env as unknown) as CONFIG
const dbConfig = {
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_DATABASE,
}
const pool = mysql.createPool(dbConfig)

function decodeBase64(src: string) {
    return Buffer.from(src, 'base64')
}

// https://developers.google.com/web/updates/2016/03/web-push-encryption
// 

// Simplified HKDF, returning keys up to 32 bytes long
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number) {
    if (length > 32) {
        throw new Error('Cannot return keys of more than 32 bytes, ${length} requested')
    }

    // Extract
    const keyHmac = crypto.createHmac('sha256', salt)
    keyHmac.update(ikm)
    const key = keyHmac.digest()

    // Expand
    const infoHmac = crypto.createHmac('sha256', key)
    infoHmac.update(info)
    // A one byte long buffer containing only 0x01
    const ONE_BUFFER = Buffer.alloc(1).fill(1)
    infoHmac.update(ONE_BUFFER)
    return infoHmac.digest().slice(0, length)
}

function createInfo(type: string, clientPublicKey: Buffer, serverPublicKey: Buffer) {
    const len = type.length

    // The start index for each element within the buffer is:
    // value               | length | start    |
    // -----------------------------------------
    // 'Content-Encoding: '| 18     | 0        |
    // type                | len    | 18       |
    // nul byte            | 1      | 18 + len |
    // 'P-256'             | 5      | 19 + len |
    // nul byte            | 1      | 24 + len |
    // client key length   | 2      | 25 + len |
    // client key          | 65     | 27 + len |
    // server key length   | 2      | 92 + len |
    // server key          | 65     | 94 + len |
    // For the purposes of push encryption the length of the keys will
    // always be 65 bytes.
    const info = Buffer.alloc(18 + len + 1 + 5 + 1 + 2 + 65 + 2 + 65)

    // The string 'Content-Encoding: ', as utf-8
    info.write('Content-Encoding: ')
    // The 'type' of the record, a utf-8 string
    info.write(type, 18)
    // A single null-byte
    info.write('\0', 18 + len)
    // The string 'P-256', declaring the elliptic curve being used
    info.write('P-256', 19 + len)
    // A single null-byte
    info.write('\0', 24 + len)
    // The length of the client's public key as a 16-bit integer
    info.writeUInt16BE(clientPublicKey.length, 25 + len)
    // Now the actual client public key
    clientPublicKey.copy(info, 27 + len)
    // Length of our public key
    info.writeUInt16BE(serverPublicKey.length, 92 + len)
    // The key itself
    serverPublicKey.copy(info, 94 + len)

    return info;
}

export default async function main(buffer: Buffer, header: { [key: string]: string | string[] }, uuid: string) {
    try {
        /////////////////////////////////////////////

        // Application server public key (senderPublic)
        // crypto-key ヘッダの前半、dh=xxx; の中味
        // crypto-key: dh=BLJQjupjQyujhTC--_5xRUgcBfAP_zINsAGTlaDuEME7s9TVgQYsyrzrgbt1vqScmZkoj4BWfPit6EzzaXDW02I;p256ecdsa=BDmWlrZ3gvcv0R7sBhaSp_99FRSC3bBNn9CElRvbcviwYwVPL1Z-G9srAJS6lv_pMe5IkTmKgBWUCNefnN3QoeQ
        const cryptoKey = header['crypto-key']
        if (typeof cryptoKey !== 'string') return false
        const senderPublicReg = cryptoKey.match(/^dh=([^;]+).+/)
        if (!senderPublicReg) return false
        const senderPublic = decodeBase64(senderPublicReg[1])
        const serverKeyReg = cryptoKey.match(/.+p256ecdsa=([^;]+)$/)
        console.log('1st step', cryptoKey)
        if (!serverKeyReg) return false
        const serverKey = serverKeyReg[1]
        console.log(serverKey)
        const sql = my(config.DB_TABLE).select().where('uuid', uuid).toString()
        console.log(sql)
        const [rows, fields] = await pool.query(sql) as any
        const row = rows[0] as DB
        console.log(row, serverKey)
        if (!row) return false

        // Authentication secret (authSecret)
        // 購読時に指定する
        const authSecret = decodeBase64(row.auth)

        // User agent public key (receiverPublic)
        // 購読時に指定する
        const receiverPublic = decodeBase64(row.publicKey)

        // User agent private key (receiverPrivate)
        const receiverPrivate = decodeBase64(row.privateKey)

        // encryption ヘッダから
        const encryptionHeader = header.encryption
        if (typeof encryptionHeader !== 'string') return false
        const saltMatch = encryptionHeader.match(/salt=(.+)/)
        console.log('2nd step')
        if (!saltMatch) return false
        const salt = decodeBase64(saltMatch[1])

        // 共有秘密鍵を作成する (エンコード時とデコード時で使う鍵が異なる)
        const receiver_curve = crypto.createECDH('prime256v1')
        receiver_curve.setPrivateKey(receiverPrivate)
        const sharedSecret = receiver_curve.computeSecret(senderPublic)

        const authInfo = Buffer.from('Content-Encoding: auth\0', 'utf8')
        const prk = hkdf(authSecret, sharedSecret, authInfo, 32)
        console.log('3rd step')
        // Derive the Content Encryption Key
        const contentEncryptionKeyInfo = createInfo('aesgcm', receiverPublic, senderPublic)
        const contentEncryptionKey = hkdf(salt, prk, contentEncryptionKeyInfo, 16)

        // Derive the Nonce
        const nonceInfo = createInfo('nonce', receiverPublic, senderPublic)
        const nonce = hkdf(salt, prk, nonceInfo, 12)
        const decipher = crypto.createCipheriv('id-aes128-GCM', contentEncryptionKey, nonce)
        let result = decipher.update(buffer)
        // remove padding and GCM auth tag
        let pad_length = 0
        if (result.length >= 3 && result[2] == 0) {
            pad_length = 2 + result.readUInt16BE(0)
        }
        result = result.slice(pad_length, result.length - 16)
        const jsonGetter = result.toString('utf8').match(/.?({.+}).?/)
        if(!jsonGetter) return false
        return [JSON.parse(jsonGetter[1]), row]
    } catch (e) {
        console.error(e)
        return false
    }
}

/*
result is
{
    "title":"あなたのトゥートが tateisu ð¤¹ さんにお気に入り登録されました"
    ,"image":null
    ,"badge":"https://mastodon2.juggler.jp/badge.png"
    ,"tag":84
    ,"timestamp":"2018-05-11T17:06:42.887Z"
    ,"icon":"/system/accounts/avatars/000/000/003/original/72f1da33539be11e.jpg"
    ,"data":{
        "content":":enemy_bullet:",
        "nsfw":null,
        "url":"https://mastodon2.juggler.jp/web/statuses/98793123081777841",
        "actions":[],
        "access_token":null,
        "message":"%{count} 件の通知",
        "dir":"ltr"
    }
}
*/