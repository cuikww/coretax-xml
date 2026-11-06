#!/usr/bin/env node
import { jalankan } from './cli.js'

process.exitCode = await jalankan(process.argv.slice(2))
