import EventEmitter from 'events';
import Vorpal from "vorpal";
import {isURL} from "validator";
import {Peripheral} from "noble";
import Table from "cli-table";
import fetch, { Response as NFResponse } from "node-fetch";
import every from "lodash/every";
import isNum from "lodash/isNumber";
import getUniq from "lodash/uniq";
import {API} from "../definitions/exp-run";
import {vorpal_appdata} from "./plugins/vorpal-appdata"
import {ExpEvents} from "./exp-events";

const noble = require("noble");

export module exp_run {

    import VorpalWithAppdate = vorpal_appdata.VorpalWithAppdata;

    export class BeaconApi implements API {
        public static readonly COMMAND_NAME_GET_BEACON: string = "get-beacon";

        constructor(private vorpalInstance: Vorpal) {
            this.configureEventListeners();
            this.revivePreviousBeacon();
            this.setupBeaconGetter();
            this.setupBeaconSetter();
            this.setupBeaconsFinder();
            this.setupBeaconChecker();
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
        
        private setupBeaconsFinder() {
            const beaconsGetter = () => {
                return this.beacons;
            };

            const beacons: Peripheral[] = this.beacons;

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_FIND_BEACONS, BeaconApi.COMMAND_DESC_FIND_BEACONS)
                .validate(function(args) {
                    const time: number | null = <number>args.search_time || null;

                    let result: string | true;

                    if (time === null) {
                        result = BeaconApi.VALID_FAIL_DESC_NO_SEARCH_TIME;
                    } else if (isNum(time)) {
                        result = true;
                    } else {
                        result = BeaconApi.VALID_FAIL_DESC_NON_NUM_SEARCH_TIME;
                    }

                    return <string | true>result;
                })
                .action(function(args, callback) {
                    const vI: Vorpal = this.parent;

                    beacons.length = 0;

                    vI.log(`Scanning for beacons for ${args.search_time} milliseconds`);

                    noble.on('scanStart', () => {
                        vI.log("scanning started");
                    });

                    noble.on('scanStop', () => {
                        vI.log("scanning stopped");
                    });

                    vI.log("startScanning");
                    noble.startScanning();

                    noble.on('discover', (peripheral: Peripheral) => {
                        vI.log("Discovered peripheral: ", peripheral.advertisement.localName, peripheral.id, peripheral.address);
                        beacons.push(peripheral);
                    });

                    setTimeout(() => {
                        vI.log("stopScanning");
                        noble.stopScanning();
                        callback();
                    }, args.search_time);
                });
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

        private static readonly COMMAND_NAME_FIND_BEACONS: string = "find-beacons <search_time>";
        private static readonly COMMAND_DESC_FIND_BEACONS: string = "Finds any BLE beacons advertising (broadcasting). <search_time> sets how long you wish to scan for devices (in milliseconds).";
        private static readonly VALID_FAIL_DESC_NO_SEARCH_TIME: string = "<search_time> not set. Please set how long you wish to scan for devices.";
        private static readonly VALID_FAIL_DESC_NON_NUM_SEARCH_TIME: string = "<search_time> is not a number. Please enter a numeric value.";
        private static readonly VALID_FAIL_DESC_FIND_BEACONS: string = "Cannot find beacons.";
        private static readonly ACTION_DESC_FIND_BEACONS: string = "Finding beacons: ";
        private static readonly RESULT_DESC_FIND_BEACONS_RESPONDED: string = "Beacons responded: ";
        private static readonly RESULT_DESC_FIND_BEACONS_FAILED: string = "Beacons response: failure: ";

        private beacons: Peripheral[] = [];
        private beaconUrl: string = "";
    }
}