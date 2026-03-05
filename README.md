# TootDesk-push-server

Push server for [TheDesk mobile](https://github.com/cutls/thedesk-mobile) (old name: TootDesk)

This project is published for reference purposes during implementation. If you wish to use it as-is, please rebuild TheDesk mobile in your own Expo account.

This software is hosted at `push.thedesk.top` only for official TheDesk mobile. If you rebuild TheDesk mobile yourself, you must host this project or compatible software yourself at your domain and subscribe to push notifications for that domain.

If you try to make Mastodon client for iOS? This project will make it easy to implement push notification.
Let's clone now!

## Requirement

* Node.js >= 20
* Firebase account and Firestore collection named `subscription`
* APNs key associated with your app
  * p8 file
  * Key ID of the above .p8 file
  * Your Apple Team ID

## Deploy

* Clone and install dependencies
* Rename `.env.sample` to `.env` and fill in it
* `yarn build` or `tsc` to build
* `yarn start` or `node dist/index.js` to start

## REST API

### `POST /v2/prepare`

Request JSON payload
```json
{ 
    "domain": "mastodon.social",
    "token": "<device push token>",
    "platform": "ios"
}
```

Response
```json
{
    "success": true,
    "data": {
        "id": "29f7d57a-d76e-4a2e-b95e-b8169f8266c3",
        "subscription": {
			"endpoint": "https://push.example.com/hook/29f7d57a-d76e-4a2e-b95e-b8169f8266c3",
			"keys": {
				"p256dh": "...",
				"auth": "..."
			}
		}
    }
}
```

This data is useful for Mastodon's `POST /api/v1/push/subscription`[joinmastodon docs](https://docs.joinmastodon.org/methods/push/#create)

Request for Mastodon's POST /api/v1/push/subscription

```json
{
    "subscription": {
		"endpoint": "https://push.example.com/hook/29f7d57a-d76e-4a2e-b95e-b8169f8266c3",
		"keys": {
			"p256dh": "...",
			"auth": "..."
		}
	},
    "data": {
		"alerts": {
			"poll": true,
			"follow": true,
			"favourite": true,
			"reblog": true,
			"mention": true
		}
	}
}
```

### `POST /v2/subscribe`

Request JSON payload
```json
{ 
    "id": "29f7d57a-d76e-4a2e-b95e-b8169f8266c3",
    "serverKey": "..."
}
```

`id`: ID got from `POST /v2/prepare`  
`serverKey`: got from Mastodon's `POST /api/v1/push/subscription`(server_key)

Response
```json
{
    "success": true
}
```

### `POST /hook/:uuid`

Mastodon server will push this address with encrypted notification payload.

Check [decode.ts](https://github.com/cutls/TootDesk-push-server/blob/main/decode.ts)

## Document

* [Send notifications with FCM and APNs - Expo Documentation](https://docs.expo.dev/push-notifications/sending-notifications-custom/)
* [tateisu/webPushDecodeTest.js](https://gist.github.com/tateisu/685eab242549d9c9ffc85020f09a4b71)
