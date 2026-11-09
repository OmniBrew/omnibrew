import { defineBackend } from '@aws-amplify/backend'
import { configureData } from '@omnibrew/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'

const backend = defineBackend({ auth, data, storage })

configureData(backend.data)
