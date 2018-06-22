/// <reference path="../definitions/vorpal/vorpal.d.ts" />

import Vorpal from 'vorpal';

import { exp_run as server } from "./server-api";
import { exp_run as user } from "./user-api";

const cliName = 'exp-run';

const vorpal = new Vorpal();

vorpal.history(cliName);

const serverAPI = new server.ServerApi(vorpal);
const userAPI = new user.UserApi(vorpal);

vorpal
    .delimiter(`${cliName}$`)
    .show()
    .parse(process.argv);