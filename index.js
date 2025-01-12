const usb = require('usb')
const yargs = require('yargs')
const fs = require('fs')

const argv = yargs
    .option('f', {
        alias: 'file',
        describe: 'output video feed to file',
        type: 'string'
    })
    .option('o', {
        alias: 'stdout',
        describe: 'send video feed to stdout for playback. eg: node index.js -o | ffplay -',
        type: 'boolean'
    })
    .option('s', {
        alias: 'readsize',
        describe: 'size in bytes to queue for usb bulk interface reads',
        default: 512,
        type: 'integer'
    })
    .option('q', {
        alias: 'queuesize',
        describe: 'number of polling usb bulk read requests to keep in flight',
        default: 3,
        type: 'integer'
    })
    .option('v', {
        alias: 'verbose',
        describe: 'be noisy - does not play well with -o',
        type: 'boolean'
    })
    .help()
    .alias('help', 'h')
    .argv;

const stream = () => {
    const goggles = usb.findByIds("0x2ca3", "0x1f");

    if (!goggles) {
        console.error("Goggles USB device not found. Please connect your Goggles.")
        return usb.on("attach", stream);
    }
    
    goggles.open()
    
    if (!goggles.interfaces) {
        console.error("Couldn't open Goggles USB device")
        process.exit(1)
    }
    
    const interface = goggles.interface(3)
    interface.claim()
    
    if (!interface.endpoints) {
        console.error("Couldn't claim bulk interface")
        process.exit(1)
    }
    
    if (!argv.f && !argv.o) {
        console.log("Warning: no outputs specified")
        argv.v = true
    }
    
    let fd
    const inpoint = interface.endpoints[1]
    const outpoint = interface.endpoints[0]
    const magic = Buffer.from("524d5654", "hex")

    inpoint.timeout = 100
    
    outpoint.transfer(magic, error => {
        if (error) {
            console.error(error)
        }
        console.debug("Send magic bytes")
    })
    
    inpoint.addListener("data", data => {
        if (argv.o) {
            process.stdout.write(data)
        }
        if (argv.v) {
            console.debug(`Received ${data.length} bytes`)
        }
        if (argv.f) {
            if (!fd) {
                fd = fs.openSync(argv.f, "w")
                if (!fd) {
                    console.error(`Couldn't open file ${argv.f}: ${err}`)
                    process.exit(1)
                }
            }
            fs.writeSync(fd, data)
        }
    })
    
    inpoint.addListener("error", error => {
        console.error(error)
    })
    
    inpoint.startPoll(argv.q, argv.s)    
}

stream();