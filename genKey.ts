
import crypto from 'crypto'
import base64us from 'urlsafe-base64'


export default () => {
    const keyCurve = crypto.createECDH('prime256v1')
    keyCurve.generateKeys()
    const publicKey = keyCurve.getPublicKey()
    const privateKey = keyCurve.getPrivateKey()
    const auth = crypto.randomBytes(16)
    return {
        publicKey: base64us.encode(publicKey),
        privateKey: base64us.encode(privateKey),
        auth: base64us.encode(auth)
    }
}