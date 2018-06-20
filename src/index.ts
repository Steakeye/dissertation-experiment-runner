/// <reference path="../definitions/vorpal/vorpal.d.ts" />

import Vorpal from 'vorpal';

import { exp_run as server } from "./server-api";
import { exp_run as user } from "./user-api";

const vorpal = new Vorpal();

const serverAPI = new server.ServerApi(vorpal);
const userAPI = new user.UserApi(vorpal);

vorpal
    .delimiter('exp-run$')
    .show();