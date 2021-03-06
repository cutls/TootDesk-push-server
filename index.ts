import express from 'express'
const app = express()
import getRawBody from 'raw-body'
import bodyParser from 'body-parser'
import decode from './decode'
import notify from './notify'
import subscribe from './subscribe'
import verify from './verify'

const server = app.listen(8019, function () {
    console.log('TootDesk Notification Server is running on port 8019')
})

app.use('/hook/:id', function (req: any, res, next) {
    getRawBody(req, {
        limit: '40kb'
    }, function (err, string) {
        if (err) return next(err)
        req.aes = string
        next()
    })
})
app.post('/hook/:uuid', async function (req: any, res) {
    //req.body is a Buffer object
    const { uuid } = req.params
    //console.log(req.aes, req.headers)
    const verified = verify(req.headers)
    if (!verified) res.statusCode = 401
    if (!verified) return res.json({ success: false })
    const decodedData = await decode(req.aes, req.headers, uuid)
    if (!decodedData) res.statusCode = 400
    if (!decodedData) return res.json({ success: false })
    const [data, db] = decodedData
    if (typeof db === 'string') return res.json({ success: false })
    //console.log(data)
    await notify(data, db)
    res.json({ success: true })
})
app.use('/subscribe', bodyParser.json())
app.post('/subscribe', function (req: any, res) {
    //req.body is a Buffer object
    const r = subscribe(req.body)
    res.json({ success: r })
})
app.get('/', function (req: any, res) {
    res.json({ iam: 'TootDesk push server' })
})
