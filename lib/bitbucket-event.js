const crypto = require('crypto')

const _ = require('lodash')

const rollbar = require('./rollbar')

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

  server.route({
    method: 'POST',
    path: '/bitbucket/init',
    handler: initHandler,
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

    const {payload} = request

    const [type, action] = eventName.split(':')

    const parsedPayload = JSON.parse(payload.toString())
    parsedPayload.name = 'bitbucket-event'
    parsedPayload.type = type
    parsedPayload.action = action

    console.log('parsedPayload', parsedPayload)

    try {
      console.log('sending to queue:', env.QUEUE_NAME)
      await channel.sendToQueue(env.QUEUE_NAME, Buffer.from(JSON.stringify(parsedPayload)), [type, action])
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

  async function initHandler (request, reply) {
    console.log('In initHandler')
    const {payload} = request

    const parsedPayload = JSON.parse(payload.toString())
    parsedPayload.name = 'bitbucket-event'
    parsedPayload.type = 'repo'
    parsedPayload.action = 'init'

    console.log('parsedPayload', parsedPayload)

    try {
      console.log('sending to queue:', env.QUEUE_NAME)
      await channel.sendToQueue(env.QUEUE_NAME, Buffer.from(JSON.stringify(parsedPayload)),
          [parsedPayload.type, parsedPayload.action])
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
