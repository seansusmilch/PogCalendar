import {calendar_v3, google} from 'googleapis'
import {readFile, readFileSync, writeFile} from 'fs'
import util from 'util'
import { getConfig, input } from './helpers'
import {CronJob} from 'cron'


const TOKEN_PATH = 'token.json'
const CREDS_PATH = 'credentials.json'
// const CAL_ID = '6s2lp4b33arle8flb067v7784s@group.calendar.google.com'
// const HOMIES = ['dangledickrick@gmail.com', 'seantsusmilch@gmail.com']

const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']

// const sleep = (waitTimeInMs:number) => new Promise(resolve => setTimeout(resolve, waitTimeInMs))
// const writeFileAsync = util.promisify(writeFile)
const readFileAsync = util.promisify(readFile)
const loadJSONAsync = (filename: string): Promise<any> => {
    return readFileAsync(filename, 'utf8')
        .then((res)=>JSON.parse(res))
}

// const getCal = () => new Promise<calendar_v3.Calendar>(async(resolve, reject) => {
//     const creds = await loadJSONAsync(CREDS_PATH)
    
//     const {client_secret, client_id, redirect_uris} = creds.installed
//     const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

//     const token = loadJSONAsync(TOKEN_PATH)
//         .catch((err) =>{
//             console.log(`\n\nERROR CAUGHT!!!11\n${err.message}\n\n`)
//             const authUrl = oAuth2Client.generateAuthUrl({
//                 access_type: 'offline',
//                 scope: SCOPES,
//             })
//             console.log('Authorize this app by visiting this url:', authUrl)

//             return input('Enter the code: ')
//                 .then((code)=>{
//                     return oAuth2Client.getToken(code, (err, t)=>{
//                         writeFile(TOKEN_PATH, JSON.stringify(t),()=>{
//                             console.log('Token stored successfully')
//                         })
//                     })
//                 })
//         })

//     oAuth2Client.setCredentials(await token)
//     resolve(google.calendar({version:'v3', auth: oAuth2Client}))
// })


// const getCalendar = async () => {
//     var oAuth2Client = new google.auth.OAuth2
//     try{
//         const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'))
//         const {client_secret, client_id, redirect_uris} = creds.installed;
//         oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
//     }catch(err){
//         console.error('Error loading client secret file:', err)
//         return
//     }
//     // console.log(oAuth2Client)

//     try{
//         const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'))
//         oAuth2Client.setCredentials(token)
//         return google.calendar({version:'v3', auth: oAuth2Client})
//     }catch(err){
//         const authUrl = oAuth2Client.generateAuthUrl({
//             access_type: 'offline',
//             scope: SCOPES,
//         })
//         console.log('Authorize this app by visiting this url:', authUrl)
//         const rl = readline.createInterface({
//             input: process.stdin,
//             output: process.stdout,
//         })
//         rl.question('Enter the code from that page here: ', (code) => {
//             oAuth2Client.getToken(code, async (err, token) => {
//                 if (err) return console.error('Error retrieving access token', err)
        
//                 oAuth2Client.setCredentials(token)
//                 // Store the token to disk for later program executions
//                 writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
//                     if (err) return console.error(err)
//                     console.log('Token stored to', TOKEN_PATH)
//                 })
//                 rl.close()
//                 return google.calendar({version:'v3', auth: oAuth2Client})
//             })
            
//         })
//     }
//     return google.calendar({version:'v3', auth: oAuth2Client})
// }


export class HomieInviter {
    cal: calendar_v3.Calendar
    emails: string[]
    calId: string
    destId: string
    checkInterval:number    // in seconds

    cronJob: CronJob

    constructor(cal_id:string, dest_cal_id:string, to_invite:string[]=[], check_every:number = 10) {
        this.calId = cal_id
        this.destId = dest_cal_id
        this.emails = to_invite
        this.checkInterval = check_every
        console.log(`Received initial params for calendar:`)
        console.log(`\tcalId: ${cal_id}`)
        console.log(`\tdestId: ${dest_cal_id}`)
        console.log(`\temails: ${to_invite}`)

        this.cronJob = new CronJob(`*/${check_every} * * * * *`, async()=>{
            this.checkForNew()
        })
    }

    setup = async ()=>{
        this.cal = await this.getCal()
        console.log(`Checking for new events every ${this.checkInterval}s`)
        this.cronJob.start()
    }

    getCal = () => new Promise<calendar_v3.Calendar>(async(resolve, reject) => {
        const creds = await loadJSONAsync(CREDS_PATH)
        
        const {client_secret, client_id, redirect_uris} = creds.installed
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    
        const token = loadJSONAsync(TOKEN_PATH)
            .catch((err) =>{
                const authUrl = oAuth2Client.generateAuthUrl({
                    access_type: 'offline',
                    scope: SCOPES,
                })
                console.log('Authorize this app by visiting this url:', authUrl)
    
                return input('Enter the code: ')
                    .then((code)=>{
                        console.log(code)
                        return oAuth2Client.getToken(code).then((res)=>{
                            writeFile(TOKEN_PATH, JSON.stringify(res.tokens),()=>{
                                console.log('Token stored successfully')
                            })
                            return res.tokens
                        })
                    })
            })
        oAuth2Client.setCredentials(await token)
        resolve(google.calendar({version:'v3', auth: oAuth2Client}))
    })

    getEventIdByUrl = (url:string) => {
        console.log('Searching for event at ', url)
        return this.cal.events.list({
            calendarId: this.calId,
            // calendarId: this.destId,
            singleEvents: true
        })
        .then((res)=>{
            const events = res.data.items
            if(!events)
                console.error('Event not found!')
            
            for (const event of events) {
                if(event.htmlLink == url){
                    console.log('Event found!')
                    // console.log(event.attendees)
                    return event
                }
            }
            console.error('Event not found!')
        })
    }

    inviteEmails = (event:calendar_v3.Schema$Event) => {
        return this.cal.events.update({
            calendarId: this.calId,
            eventId: event.id,

            requestBody: {
                ...event,
                guestsCanModify: true,
                guestsCanSeeOtherGuests: true,
                attendees: [
                    ...this.emails.map((val)=>{
                        return {email:val, responseStatus:'needsAction', optional: true}
                    })
                ]
            }
        })
        .then((res)=>{
            const event = res.data
            console.log('Homies invited!')
            console.log(event.attendees)
        })
    }

    runFromUrl = (url:string) => {
        return this.getEventIdByUrl(url)
            .then((event)=>{
                // return this.inviteEmails(event)
                return this.inviteAndDelete(event)
            })
    }

    runFromEvent = (event:calendar_v3.Schema$Event) => {
        console.log(`Proccessing event "${event.summary}"`)
        return this.inviteAndDelete(event)
    }

    inviteAndDelete = (event:calendar_v3.Schema$Event) => {
        console.log('Making new event')
        console.log(event)
        return this.cal.events.insert({
            calendarId: this.destId,
            sendNotifications: true,
            requestBody: {
                ...event,
                
                guestsCanModify: true,
                guestsCanSeeOtherGuests: true,
                description: (event.description ? event.description+'\n\n' : '') + `created by ${event.creator.email}`,
                attendees: [
                    ...this.emails.map((val)=>{
                        return {email:val, responseStatus:'needsAction', optional: true}
                    })
                ]
            }
        })
        .then((newEvent)=>{
            console.log(`New event created at ${newEvent.data.htmlLink}`)
            return this.cal.events.delete({
                calendarId: this.calId,
                eventId: event.id
            })
        })
    }

    checkForNew = async ()=>{
        // console.debug('Checking for new events')
        const now = new Date()
        const secs = 15
        const secondsAgo = new Date(now.getTime() - secs*1000)

        this.cal.events.list({
            calendarId: this.calId,
            maxResults: 10,
            updatedMin: secondsAgo.toISOString()
        })
        .then((res)=>{
            const events = res.data.items
            for(let ev of events){
                if(ev.status == 'cancelled') continue
                this.runFromEvent(ev)
            }
        })
    }
}

// const main = async () => {
//     const calendar = await getCal()
//     calendar.events.list({
//         calendarId: CAL_ID,
//         // eventId: 'b3cqe9090eff9tvablfod3hh1s',
//         // eventId: '4/1AX4XfWjO2nzTzRMcaQkOwbUQYcOagOtUydv_dwHOhjjOGRPf02XGqGqzk5c',
//         // timeMin: (new Date()).toISOString(),
//         maxResults: 10,
//         singleEvents: true,
//         // orderBy: 'startTime',
//     }, (err, res) => {
//         if (err) return console.error('API Error: ', err)
//         const event = res.data.items
//         console.log(event)
//         // if(events.length == 0){
//         //     console.log('No events found')
//         //     return
//         // }
//         // console.log('Upcoming:')
//         // for (const ev of events) {
//         //     console.log(`${ev.summary} - ${ev.htmlLink}\n${JSON.stringify(ev, null, 4)}`)
//         // }
//     })
// }

// main()
// getCal().then((val)=>console.log(val))

const pog = async () => {
    const config = getConfig()
    const homes = new HomieInviter(
        config.calendar.listen_calId, 
        config.calendar.dest_calId, 
        config.calendar.emails
    )
    await homes.setup()
    const event = await homes.getEventIdByUrl('https://www.google.com/calendar/event?eid=MDNhNG9kY2Q2NHFyNmY1Nzk2MHFwcG4zbWYgNnMybHA0YjMzYXJsZThmbGIwNjd2Nzc4NHNAZw')
    homes.inviteEmails(event)
}