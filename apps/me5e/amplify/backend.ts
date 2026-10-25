import { defineBackend } from '@aws-amplify/backend'
import { configureData } from '@omnibrew/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'

const backend = defineBackend({ auth, data })

configureData(backend.data)
