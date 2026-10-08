import {getUser,getSettings} from '@netlify/identity';
import {createSessionHandler} from '../../src/session-policy.mjs';
// v2 Function: no raw-token parsing, email allowlist or browser-controlled roles.
export default createSessionHandler(getUser,getSettings);
