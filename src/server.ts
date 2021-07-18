import configYaml from 'config-yaml'
import express from 'express'
import {HomieInviter} from './calendar'
import { getConfig } from './helpers'

const config = getConfig()

const app = express()
app.use(express.text({limit:'100mb'}))

const homie = new HomieInviter(config.calendar.listen_calId, config.calendar.dest_calId, config.calendar.emails)

app.get('/', (req, res) =>{
    res.send('Automatic Calendar Inviter')
})

app.post('/calendar', (req, res) =>{
    console.log(req.body)
    homie.runFromUrl(req.body)
    res.send(req.body)
})

app.listen(config.express?.port, async()=>{
    console.log(`Listening at http://localhost:${config.express?.port}`)
    await homie.setup()
})