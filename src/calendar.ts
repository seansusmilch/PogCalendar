import {calendar_v3, google} from 'googleapis'
import { getConfig, input, loadJSONAsync } from './helpers'
import {writeFile} from 'fs'

import {CronJob} from 'cron'

const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']

// const readFileAsync = util.promisify(readFile)
// const loadJSONAsync = (filename: string): Promise<any> => {
//     return readFileAsync(filename, 'utf8')
//         .then((res)=>JSON.parse(res))
// }
export class HomieInviter {
    cal: calendar_v3.Calendar
    emails: string[]
    calId: string
    destId: string
    checkInterval:number    // in seconds

    cronJob: CronJob

    tokenPath:string
    credsPath:string


    constructor(cal_id:string, dest_cal_id:string, to_invite:string[]=[], check_every:number = 10, path:string='./config') {
        this.calId = cal_id
        this.destId = dest_cal_id
        this.emails = to_invite
        this.checkInterval = check_every
        console.log(`Received initial params for calendar:`)
        console.log(`\tcalId: ${cal_id}`)
        console.log(`\tdestId: ${dest_cal_id}`)
        console.log(`\temails: ${to_invite}`)

        this.tokenPath = `${path}/token.json`
        this.credsPath = `${path}/credentials.json`
        console.log(this.tokenPath, this.credsPath)

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
        const creds = await loadJSONAsync(this.credsPath)
        
        const {client_secret, client_id, redirect_uris} = creds.installed
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    
        const token = loadJSONAsync(this.tokenPath)
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
                            writeFile(this.tokenPath, JSON.stringify(res.tokens),()=>{
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

    runFromUrl = (url:string) => {
        return this.getEventIdByUrl(url)
            .then((event)=>{
                // return this.inviteEmails(event)
                return this.inviteAndDelete(event)
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

const main = async () => {
    const config = getConfig()
    const homes = new HomieInviter(
        config.calendar.listen_calId, 
        config.calendar.dest_calId, 
        config.calendar.emails,
        config.calendar.check_secs,
        config.usepath
    )
    await homes.setup()
}
main()