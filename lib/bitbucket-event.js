const crypto = require('crypto')

const _ = require('lodash')

const rollbar = require('./rollbar')

const bitbucketEvents = {
  'repo:push': {
    priority: 3
  },
  'repo:commit_status_updated': {
    priority: 2
  },
  'repo:commit_status_created': {
    priority: 2
  },
  //integration_installation: {
  //  created: {
  //    priority: 3
  //  },
  //  deleted: {
  //    priority: 5
  //  }
  //},
  //integration_installation_repositories: {
  //  priority: 4
  //},
  //public: {
  //  priority: 3
  //}
}

const blacklist = [
  'repo:fork',
  'repo:updated',
  'repo:transfer',
  'repo:commit_comment_created',
]

module.exports = bitbucketEvent
module.exports.attributes = {
  name: 'bitbucket'
}

function bitbucketEvent (server, {env, channel}, next) {
  server.route({
    method: 'POST',
    path: '/bitbucket',
    handler,
    config: {
      payload: {
        output: 'data',
        parse: false
      }
    }
  })

  async function handler (request, reply) {
    const eventName = request.headers['x-event-key']

    if (_.includes(blacklist, eventName)) return reply({ok: true}).code(202)

    console.log(eventName)

    //const event = bitbucketEvents[eventName] || {
    //  priority: 1
    //}
    const event = bitbucketEvents[eventName]

    console.log(event)

    const {payload} = request
    //const hmacPayload = crypto.createHmac('sha1', env.WEBHOOKS_SECRET)
    //.update(payload)
    //.digest('hex')

    //const signature = request.headers['x-hub-signature']
    //if (`sha1=${hmacPayload}` !== signature) {
    //  return reply({error: true}).code(403)
    //}
    //
    console.log(payload.toString())

    const parsedPayload = JSON.parse(payload.toString())
    parsedPayload.name = 'bitbucket-event'
    parsedPayload.type = eventName

    //const options = _.get(event, [parsedPayload.action], event)
    options = eventName.split(':')[1]

    console.log(options)

    console.log('parsedPayload', parsedPayload)

    try {
      console.log('sending to queue:', env.QUEUE_NAME)
      await channel.sendToQueue(env.QUEUE_NAME, Buffer.from(JSON.stringify(parsedPayload)), options)
    } catch (err) {
      console.error(err)
      rollbar.error(err, _.assign({}, request.raw.req, {
        socket: {
          encrypted: request.server.info.protocol === 'https'
        },
        connection: {
          remoteAddress: request.info.remoteAddress
        }
      }))
      return reply({error: true}).code(500)
    }

    reply({ok: true}).code(202)
  }

  next()
}
