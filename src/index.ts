/// <reference path="../definitions/vorpal/vorpal.d.ts" />

import Vorpal from 'vorpal';
import EventEmitter from 'events';
import { exp_run as server } from "./server-api";
import { exp_run as user } from "./user-api";
import { exp_run as meta } from "./meta-api";

const cliName = 'exp-run';

const vorpal = new Vorpal();
const evtEmitter = new EventEmitter();

vorpal.history(cliName);
vorpal.version("0.1.0");
vorpal.localStorage(cliName);

const serverAPI = new server.ServerApi(vorpal, evtEmitter);
const userAPI = new user.UserApi(vorpal, evtEmitter);
const metaAPI = new meta.MetaApi(vorpal, evtEmitter);

vorpal
    .delimiter(`${cliName}$`)
    .show()
    .parse(process.argv);