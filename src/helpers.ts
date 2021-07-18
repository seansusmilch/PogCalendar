import configYaml from 'config-yaml'
import readline from 'readline'

export const sleep = (waitTimeInMs:number) => new Promise(resolve => setTimeout(resolve, waitTimeInMs))

export const getConfig = ()=>{
    var config:any = {}
    const confPaths = [
        './config/config.yml',
        './config/config.yaml',
        './data/config.yml',
        './data/config.yaml',
        '/config/config.yml',
        '/config/config.yaml',
        '/data/config.yml',
        '/data/config.yaml'
    ]
    for(const path of confPaths){
        try{
            var tempconfig = configYaml(path)
            console.warn(`Using config file at ${path}`)
            console.log(tempconfig)
            config = tempconfig
            break
        }catch(err){}
    }
    return config
}

export const input = async (prompt:string) => {

    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    })    
    process.stdout.write(prompt)
    let result = undefined;
    rl.on('line', (line)=>{
        result = line;
    })

    while(!result) await sleep(100);

    return result;
}