/*
    tateisu JWT verify
    https://gist.github.com/tateisu/18e9807dfb8779c247d6297bcf445686
*/
import jwt from 'jsonwebtoken'
import asn from 'asn1.js'
// const fs = require('fs')

// ECDSA public key ASN.1 format
const ECPublicKey = asn.define('PublicKey', function (e: any) {
    const app = e as any
    app.seq().obj(
        app.key('algorithm').seq().obj(
            app.key('id').objid(),
            app.key('curve').objid()
        ),
        app.key('pub').bitstr()
    );
});

// convert public key from p256ecdsa to PEM
function getPemFromPublicKey(public_key: Buffer) {
    return ECPublicKey.encode({
        algorithm: {
            id: [1, 2, 840, 10045, 2, 1],  // :id-ecPublicKey
            curve: [1, 2, 840, 10045, 3, 1, 7] // prime256v1
        },
        pub: {
            // このunused により bitstringの先頭に 00 が置かれる。
            // 先頭の00 04 が uncompressed を示す
            // https://tools.ietf.org/html/rfc5480#section-2.3.2
            // http://www.secg.org/sec1-v2.pdf section 2.3.3
            unused: 0,
            data: public_key,
        },
    }, 'pem', { label: 'PUBLIC KEY' })
}

function decodeBase64(src: string) {
    return Buffer.from(src, 'base64')
}

export default function main(header: { [key: string]: string | string[] }) {
    console.log('initial step')
    const authHeader = header['Authorization']
    const cryptoKey = header['Crypto-Key']
    if (typeof authHeader !== 'string') return false
    if (typeof cryptoKey !== 'string') return false
    console.log('1st step')
    const reAuthorizationWebPush = new RegExp('^WebPush\\s+(\\S+)')
    const reCryptoKeySignPublicKey = new RegExp('p256ecdsa=([^;\\s]+)')

    let m = reAuthorizationWebPush.exec(authHeader)
    if (!m) {
        console.log('header not match: Authorization')
        return false
    } else {
        console.log('2nd step')
        const token = m[1]

        m = reCryptoKeySignPublicKey.exec(cryptoKey)
        if (!m) {
            console.log('header not match: Crypto-Key')
        } else {
            console.log('3rd step')
            const publicKey = decodeBase64(m[1])
            const pem = getPemFromPublicKey(publicKey)
            // fs.writeFileSync("./public2.pem", pem + "\n");
            console.log('last step')
            const decoded = jwt.verify(token, Buffer.from(pem), { algorithms: ['ES256'] })
            console.log(decoded)
            // { aud: 'https://mastodon-msg.juggler.jp',exp: 1526559986,sub: 'mailto:tateisu@gmail.com' }

            // error case
            try {
                const decoded2 = jwt.verify(token + 'xxx', Buffer.from(pem), { algorithms: ['ES256'] })
                console.log('verifing...')
                if (decoded2) return true
                return false
            } catch (err) {
                console.log(`verify failed: ${err}`)
                // verify failed: JsonWebTokenError: invalid token
            }
        }
    }
}


/*
JWTトークンの署名の検証
(1) openSSLで作成したPEMファイルで署名の作成と検証
(2) 公開鍵をp256ecdsaバイトデータからPEMフォーマットに変換
// jsonwebtoken はPEMファイルがあればjwtのエンコードとデコード(署名検証)ができる
// openssl ecparam -genkey -name prime256v1 -noout -out private.pem
// openssl ec -in private.pem -pubout -out public.pem
var priv = fs.readFileSync('./private.pem')
var token = jwt.sign("{ foo: 'bar' }", priv, { algorithm: 'ES256' })
console.log(token)
var pub = fs.readFileSync('./public.pem')
var decoded = jwt.verify(token, pub, { algorithms: ['ES256'] })
console.log(decoded)
dump of pem file
$ openssl asn1parse -in public.pem -dump
    0:d=0  hl=2 l=  89 cons: SEQUENCE
    2:d=1  hl=2 l=  19 cons: SEQUENCE
    4:d=2  hl=2 l=   7 prim: OBJECT            :id-ecPublicKey
   13:d=2  hl=2 l=   8 prim: OBJECT            :prime256v1
   23:d=1  hl=2 l=  66 prim: BIT STRING
      0000 - 00 04 e0 a5 f8 06 b7 0a-05 cc fa 97 06 cb f8 04   ................
      0010 - 0c 1b e3 52 13 3d bb a9-de 74 7d 25 ac 7b 39 d0   ...R.=...t}%.{9.
      0020 - e1 e6 ee 3a 96 47 9f be-41 ae c2 ff d0 36 53 43   ...:.G..A....6SC
      0030 - 88 e6 5d f7 a4 09 32 13-d6 57 e5 91 3f 5d d6 70   ..]...2..W..?].p
      0040 - 07 c2
d:depth
hl:header length (tag and length octets) of the current type.
l: length of the contents octets.
*/