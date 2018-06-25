/// <reference path="../definitions/vorpal/vorpal.d.ts" />

import Vorpal from 'vorpal';
import VorpalLog from 'vorpal-log';
import { vorpal_appdata as appData } from "./plugins/vorpal-appdata";
import { exp_run as server } from "./server-api";
import { exp_run as user } from "./user-api";
import { exp_run as meta } from "./meta-api";

const cliName = 'exp-run';

const vorpal = new Vorpal();

vorpal.use(appData.VorpalAppdata, cliName);
vorpal.use(VorpalLog);

vorpal.history(cliName);
vorpal.version("0.1.0");
vorpal.localStorage(cliName);

vorpal
    .delimiter(`${cliName}$`)
    .show()
    .log("Welcome to the test experiment runner! Type 'help' for a list of instructions to type into the console.");
    //.parse(process.argv);

const metaAPI = new meta.MetaApi(vorpal);
const serverAPI = new server.ServerApi(vorpal);
const userAPI = new user.UserApi(vorpal);

vorpal.parse(process.argv)