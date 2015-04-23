## Published Event Messages

### connected

#### Data Sent
- messageType = "connectedEvent"
- deviceType
- deviceId

### disconnected
#### Data Sent
- messageType = "disconnectedEvent"
- deviceType
- deviceId

## Command Messages

### deviceReady
#### Request Parameters
- messageType = "deviceReady"

#### Response
- messageType = "deviceReadyResponse"
- result: Boolean