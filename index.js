'use strict';
console.log('Loading function');

let doc = require('dynamodb-doc');
let dynamo = new doc.DynamoDB();
let tableName = 'ses-mailing';

exports.handler = (event, context, callback) => {
    //console.log('Received event:', JSON.stringify(event, null, 2));
    const message = JSON.parse(event.Records[0].Sns.Message);
    
    var eventType = message.eventType;
    if (eventType == undefined) {
        eventType = message.notificationType;
    }
    switch(eventType) {
        case "Bounce":
            handleBounce(message);
            break;
        case "Complaint":
            handleComplaint(message);
            break;
        case "Send":
            handleDelivery(message);
            break;
        case "Delivery":
            handleDelivery(message);
            break;
            
        case "Open":
            handleOpen(message);
            break;
            
        default:
            callback("Unknown notification type: " + message.notificationType);
    }
};

function handleBounce(message) {
    const messageId = message.mail.messageId;
    const addresses = message.bounce.bouncedRecipients.map(function(recipient){
        return recipient.emailAddress;
    });
    const bounceType = message.bounce.bounceType;

    console.log("Message " + messageId + " bounced when sending to " + addresses.join(", ") + ". Bounce type: " + bounceType);

    for (var i=0; i<addresses.length; i++){
        writeDDB(addresses[i], message, tableName, "disable");
    }
}

function handleComplaint(message) {
    const messageId = message.mail.messageId;
    const addresses = message.complaint.complainedRecipients.map(function(recipient){
        return recipient.emailAddress;
    });

    console.log("A complaint was reported by " + addresses.join(", ") + " for message " + messageId + ".");

    for (var i=0; i<addresses.length; i++){
        writeDDB(addresses[i], message, tableName, "disable");
    }
}

function handleDelivery(message) {
    const messageId = message.mail.messageId;
    const deliveryTimestamp = message.mail.timestamp;
    const addresses = message.mail.destination;
    console.log("Message " + messageId + " was delivered successfully at " + deliveryTimestamp + ".");

    for (var i=0; i<addresses.length; i++){
        writeDDB(addresses[i], message, tableName, "enable");
    }
}
function handleOpen(message) {
    const messageId = message.mail.messageId;
    const deliveryTimestamp = message.open.timestamp;
    const addresses = message.mail.destination;
    console.log("Message " + messageId + " was opened at " + deliveryTimestamp + ".");

    for (var i=0; i<addresses.length; i++){
        writeDDB(addresses[i], message, tableName, "enable");
    }
}

function writeDDB(id, payload, tableName, status) {
    const tags = payload.mail.tags;
    var configuration_set = null;
    var source_ip = null;
    var from_domain = null;
    var tenant = null;
    
    if (tags != undefined ) {
        console.log('Received tags:', JSON.stringify(tags, null, 2));
        if ('ses:configuration-set' in tags) {
            configuration_set = tags['ses:configuration-set'].join(',');
        }
        if ('ses:source-ip' in tags) {
            source_ip = tags['ses:source-ip'].join(',');
        }
        if ('ses:from-domain' in tags) {
            from_domain = tags['ses:from-domain'].join(',');
        }
        if ('tenant' in tags) {
            tenant = tags['tenant'].join(',');
        }
            
    }

    var eventType = payload.eventType;
    if (eventType == undefined) {
        eventType = payload.notificationType;
    }

    const item = {
            UserId: id,
            eventType: eventType,
            from: payload.mail.source,
            messageId: payload.mail.messageId,
            timestamp: payload.mail.timestamp,
            state: status,
            configuration_set: configuration_set,
            source_ip: source_ip,
            from_domain: from_domain,
            tenant: tenant
        };
    const params = {
            TableName:tableName,
            Item: item
        };
    dynamo.putItem(params,function(err,data){
            if (err) console.log(err);
            else console.log(data);
    });
}
