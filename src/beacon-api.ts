import EventEmitter from 'events';
import Vorpal from "vorpal";
import {isURL} from "validator";
import * as noble from "noble";
import fetch, { Response as NFResponse } from "node-fetch";
import {API} from "../definitions/exp-run";
import {vorpal_appdata} from "./plugins/vorpal-appdata"
import {ExpEvents} from "./exp-events";

export module exp_run {

    import VorpalWithAppdate = vorpal_appdata.VorpalWithAppdata;

    export class BeaconApi implements API {
        public static readonly COMMAND_NAME_GET_BEACON: string = "get-beacon";
        public static readonly COMMAND_NAME_GET_BEACON_REDIRECT: string = "get-beacon-redirect";
        public static readonly COMMAND_NAME_SET_BEACON_REDIRECT: string = "set-beacon-redirect";

        constructor(private vorpalInstance: Vorpal) {
            this.configureEventListeners();
            this.revivePreviousBeacon();
            this.setupBeaconGetter();
            this.setupBeaconSetter();
            this.setupBeaconChecker();
            this.setupBeaconRedirectGetter();
            this.setupBeaconRedirectSetter();
        }

        public get url(): string { return this.beaconUrl; }

        private configureEventListeners(): void {
            const vI = this.vorpalInstance;

            this.onRequestBeacon = this.onRequestBeacon.bind(this);

            vI.on(ExpEvents.REQUEST_BEACON, this.onRequestBeacon);
        }

        private onRequestBeacon(cb: (url: string | null) => void) : void {
            cb(this.beaconUrl || null);
        }

        private revivePreviousBeacon(): void {
            const getBeaconCB = (val: string) => {
                this.beaconUrl = val || "";
            };

            (<VorpalWithAppdate>this.vorpalInstance).appData.getItem(BeaconApi.STORAGE_KEY_CURRENT_BEACON).then(getBeaconCB);
        }

        private setupBeaconGetter() {
            const beaconGetter = () => {
                return this.beaconUrl;
            };

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_GET_BEACON, BeaconApi.COMMAND_DESC_GET_BEACON)
                .action(function(args, callback) {
                    const url: string = beaconGetter();
                    const message: string = url.length ? `${BeaconApi.ACTION_DESC_GET_BEACON}${url}` : BeaconApi.ACTION_DESC_GET_BEACON_NOT_SET;

                    this.log(message);

                    callback();
                });
        }

        private setupBeaconSetter() {
            const beaconSetter = (url: string) => {
                this.beaconUrl = url;
                (<VorpalWithAppdate>this.vorpalInstance).appData.setItem(BeaconApi.STORAGE_KEY_CURRENT_BEACON, url);
            };

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_SET_BEACON, BeaconApi.COMMAND_DESC_SET_BEACON)
                .validate(function (args) {
                    const url: string | null = <string>args.url || null;

                    let result: string | true;

                    if (url === null || isURL(<string>url, { require_tld: false })) {
                        result = true;
                    } else {
                        result = BeaconApi.VALID_FAIL_DESC_SET_BEACON_URL;
                    }

                    return result;
                })
                .action(function(args, callback) {
                    const url: string = <string>args.url;
                    const message: string = url ? `${BeaconApi.ACTION_DESC_SET_BEACON}${url}` : BeaconApi.ACTION_DESC_SET_BEACON_EMPTY;

                    this.log(message);
                    beaconSetter(url || '');

                    callback();
                });
        }


        private setupBeaconChecker() {
            const beaconGetter = () => {
                return this.beaconUrl;
            };

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_CHECK_BEACON, BeaconApi.COMMAND_DESC_CHECK_BEACON)
                .action(function(args, callback) {
                    const url: string = beaconGetter();
                    const beaconSet: boolean = !!url.length;
                    const message: string = beaconSet ? `${BeaconApi.ACTION_DESC_CHECK_BEACON}${url}` : BeaconApi.VALID_FAIL_DESC_CHECK_BEACON_URL;

                    this.log(message);

                    if (url.length) {
                        const vI: Vorpal = this.parent;

                        const resHandler = (res: NFResponse) => {
                            return `${res.status} ${res.statusText}`;
                        };
                        const textHandler = (text: string) => {
                            vI.log(`${BeaconApi.RESULT_DESC_CHECK_BEACON_RESPONDED}${text}`);
                            callback();
                        };
                        const errortHandler = (err: any) => {
                            vI.log(`${BeaconApi.RESULT_DESC_CHECK_BEACON_FAILED}${err}`);
                            callback();
                        };

                        const fetchPromise: Promise<NFResponse> = fetch(url, { method: "HEAD" });

                        fetchPromise.then(resHandler).then(textHandler, errortHandler);
                    } else {
                        callback();
                    }
                });
        }

        private setupBeaconRedirectGetter() {
            const beaconRedirectGetter = () => {
                return this.beaconRedirect;
            };

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_GET_BEACON_REDIRECT, BeaconApi.COMMAND_DESC_GET_BEACON_REDIRECT)
                .action(function(args, callback) {
                    const num: number = <number>beaconRedirectGetter();
                    const message: string = num !== null ?
                        `${BeaconApi.ACTION_DESC_GET_BEACON_REDIRECT}${num}` :
                        BeaconApi.ACTION_DESC_GET_BEACON_REDIRECT_NOT_SET;

                    this.log(message);

                    callback();
                });
        }

        private setupBeaconRedirectSetter() {
            const beaconSetter = (url: number | null, cb: () => void) => {
                this.beaconRedirect = url;
                this.requestBeaconRedirectUpdate(cb);
            };
            const beaconIsSet = () => {
                return !!this.beaconUrl.length;
            };

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_SET_BEACON_REDIRECT_WITH_ARGS, BeaconApi.COMMAND_DESC_SET_BEACON_REDIRECT)
                .validate(function (args) {
                    const num: number | null = <number>args.number || null;

                    let result: string | true;

                    if (!beaconIsSet()) {
                        result = BeaconApi.VALID_FAIL_DESC_SET_BEACON_REDIRECT_URL;
                    } else if (!BeaconApi.isRedirectWithinRange(this.parent, <number>num) && num !== null) {
                        result = BeaconApi.VALID_FAIL_DESC_SET_BEACON_REDIRECT_NUM;
                    } else {
                        result = true;
                    }

                    return result;
                })
                .action(function(args, callback) {
                    const num: number = <number>args.number;
                    const message: string = num ? `${BeaconApi.ACTION_DESC_SET_BEACON_REDIRECT}${num}` : BeaconApi.ACTION_DESC_SET_BEACON_REDIRECT_EMPTY;

                    this.log(message);
                    beaconSetter(num || null, callback);
                });
        }

        private requestBeaconRedirectUpdate(cb: () => void): void {
            const endpoint: string = `${this.beaconUrl}${BeaconApi.PATH_FRAGMENT_SET_BEACON_REDIRECT}`;
            const resHandler = (res: NFResponse) => {
                return res.text();
            };
            const textHandler = (text: string) => {
                this.vorpalInstance.log(text);
                cb();
            };
            const errortHandler = (err: any) => {
                this.vorpalInstance.log(err);
                cb();
            };

            const fetchPromise: Promise<NFResponse> = this.beaconRedirect ? fetch(`${endpoint}${this.beaconRedirect}`) : fetch(endpoint, { method: "DELETE" });

            fetchPromise.then(resHandler).then(textHandler, errortHandler);
        }

        private static isRedirectWithinRange(vI: Vorpal, num: number): boolean {
            let expRange: number[] = [];

            vI.emit(ExpEvents.REQUEST_RANGE, (range: number[], isFirstPosFixed: boolean) => {
                expRange = range;
            });

            return expRange.indexOf(num) != -1;
        }

        private static readonly STORAGE_KEY_CURRENT_BEACON: string = "current-beacon";

        private static readonly COMMAND_DESC_GET_BEACON: string = "Gets the current beacon URL";
        private static readonly ACTION_DESC_GET_BEACON: string = "Beacon URL set to: ";
        private static readonly ACTION_DESC_GET_BEACON_NOT_SET: string = "Beacon URL not set!";

        private static readonly COMMAND_NAME_SET_BEACON: string = "set-beacon [url]";
        private static readonly COMMAND_DESC_SET_BEACON: string = "Sets the beacon URL. Passing no value unsets the beacon URL.";
        private static readonly VALID_FAIL_DESC_SET_BEACON_URL: string = "Cannot set beacon URL to invalid URL";
        private static readonly ACTION_DESC_SET_BEACON: string = "Setting beacon URL to: ";
        private static readonly ACTION_DESC_SET_BEACON_EMPTY: string = "Unsetting beacon URL";

        private static readonly COMMAND_NAME_CHECK_BEACON: string = "check-beacon";
        private static readonly COMMAND_DESC_CHECK_BEACON: string = "Checks the beacon is responding.";
        private static readonly VALID_FAIL_DESC_CHECK_BEACON_URL: string = "Cannot check beacon as beacon URL not set";
        private static readonly ACTION_DESC_CHECK_BEACON: string = "Checking beacon: ";
        private static readonly RESULT_DESC_CHECK_BEACON_RESPONDED: string = "Beacon responded: ";
        private static readonly RESULT_DESC_CHECK_BEACON_FAILED: string = "Beacon response: failure: ";

        private static readonly COMMAND_DESC_GET_BEACON_REDIRECT: string = "Gets the beacon redirect endpoint";
        private static readonly ACTION_DESC_GET_BEACON_REDIRECT: string = "Beacon redirect endpoint set to: ";
        private static readonly ACTION_DESC_GET_BEACON_REDIRECT_NOT_SET: string = "Beacon redirect endpoint not set!";

        private static readonly COMMAND_NAME_SET_BEACON_REDIRECT_WITH_ARGS: string = `${BeaconApi.COMMAND_NAME_SET_BEACON_REDIRECT} [number]`;
        private static readonly PATH_FRAGMENT_SET_BEACON_REDIRECT: string = "/setredirect/";
        private static readonly COMMAND_DESC_SET_BEACON_REDIRECT: string = "Sets the beacon redirect endpoint";
        private static readonly VALID_FAIL_DESC_SET_BEACON_REDIRECT_URL: string = "Cannot set beacon redirect when beacon URL not set";
        private static readonly VALID_FAIL_DESC_SET_BEACON_REDIRECT_NUM: string = "Cannot set beacon redirect to a number out of range (1-8)";
        private static readonly ACTION_DESC_SET_BEACON_REDIRECT: string = "Setting beacon redirect endpoint to: ";
        private static readonly ACTION_DESC_SET_BEACON_REDIRECT_EMPTY: string = "Unsetting beacon redirect endpoint";

        private beaconUrl: string = "";
        private beaconRedirect: number | null = null;
    }
}