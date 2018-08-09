import Vorpal from "vorpal";
import {isURL} from "validator";
import {Characteristic, Peripheral, Service} from "noble";
import {Cell} from "cli-table2";
import fetch, { Response as NFResponse } from "node-fetch";
import some from "lodash/some";
import isNum from "lodash/isNumber";
import find from "lodash/find";
import {API} from "../definitions/exp-run";
import {vorpal_appdata} from "./plugins/vorpal-appdata"
import {ExpEvents} from "./exp-events";
import {isString} from "util";

const noble = require("noble");
const Table = require('tty-table')('automattic-cli-table');

export module exp_run {

    import VorpalWithAppdate = vorpal_appdata.VorpalWithAppdata;

    //import Table = CliTable2;

    export class BeaconApi implements API {
        constructor(private vorpalInstance: Vorpal) {
            this.setupBeaconsFinder();
            this.setupBeaconInfoGetter();
            this.setupBeaconGetter();
            this.setupBeaconSetter();
            this.setupBeaconConnect();
            this.setupBeaconDisconnect();
            //this.setupBeaconChecker();
        }

        private setupBeaconGetter() {
            const beaconGetter = () => {
                return this.currentBeacon;
            };

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_GET_BEACON, BeaconApi.COMMAND_DESC_GET_BEACON)
                .action(function(args, callback) {
                    const currentBeacon: Peripheral = <Peripheral>beaconGetter();
                    const message: string = currentBeacon ? 
                        `${BeaconApi.ACTION_DESC_GET_BEACON}${currentBeacon.advertisement.localName} ${currentBeacon.advertisement.localName} ${currentBeacon.id}` : 
                        BeaconApi.ACTION_DESC_GET_BEACON_NOT_SET;

                    this.log(message);

                    callback();
                });
        }

        private setupBeaconSetter() {
            const beaconSetter = (beacon: Peripheral) => {
                this.currentBeacon = beacon;
            };

            const beacons: Peripheral[] = this.beacons;

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_SET_BEACON, BeaconApi.COMMAND_DESC_SET_BEACON)
                .validate(function(args) {
                    const id: number | null = <number>args.beacon_id || null;

                    let result: string | true;

                    if (id === null) {
                        result = "No beacon_id provided";
                    } else if (!isString(id)) {
                        result = "beacon_id is not a string, please enter correct beacon_id";
                    } else {
                        result = true;
                    }

                    return <string | true>result;
                })
                .action(function(args, callback) {
                    const vI: Vorpal = this.parent;

                    if (!beacons.length) {
                        vI.log("No beacons found, please scan for beacons first.");

                    } else {
                        const beacon: Peripheral = <Peripheral>find(beacons, ["id", args.beacon_id ]);

                        if (beacon) {
                            beaconSetter(beacon);
                           vI.log(`${BeaconApi.ACTION_DESC_SET_BEACON}${beacon.advertisement.localName} ${args.beacon_id}`);
                        } else {
                            vI.log(`${BeaconApi.VALID_FAIL_DESC_SET_BEACON}`);
                        }
                    }

                    callback();
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

                    let startCalled: boolean = false;
                    let stoppedCalled: boolean = false;

                    beacons.length = 0;

                    vI.log(`Scanning for beacons for ${args.search_time} milliseconds`);

                    noble.on('scanStart', () => {
                        if (startCalled) return;

                        startCalled = true;

                        vI.log("scanning started");
                    });

                    noble.on('scanStop', () => {
                        if (stoppedCalled) return;

                        stoppedCalled = true;

                        vI.log("scanning stopped");

                        if (!beacons.length) {
                            vI.log(BeaconApi.VALID_FAIL_DESC_FIND_BEACONS);
                        } else {
                            const summary = new Table({
                                head: ["Name", "ID", "Address", "Address Type"],
                                colWidths: [20, 20, 20, 20]
                            });

                            vI.log("\nDiscovery summary:");
                            //summary.push(beacons.map((beacon) => [beacon.advertisement.localName.replace("\0", ''), beacon.id, beacon.address, beacon.addressType]));
                            const row: Cell[][] = beacons.map((beacon) => [beacon.advertisement.localName ? beacon.advertisement.localName.replace(/\0/g, ''): ""+beacon.advertisement.localName, beacon.id, beacon.address, beacon.addressType])
                            // @ts-ignore
                            summary.push(...row);

                            vI.log(summary.toString());
                        }

                        callback();
                    });

                    vI.log("startScanning");
                    noble.startScanning();

                    noble.on('discover', (peripheral: Peripheral) => {
                        //const existingPeripheral: boolean = some(beacons, { id: peripheral.id, address: peripheral.address, "advertisement.localName": peripheral.advertisement.localName });
                        const existingPeripheral: boolean = some(beacons, { id: peripheral.id });

                        if (!existingPeripheral) {
                            vI.log("Discovered peripheral: ", peripheral.advertisement.localName, peripheral.id, peripheral.address, peripheral.addressType);
                            beacons.push(peripheral);
                        }
                    });

                    setTimeout(() => {
                        vI.log("stopScanning");
                        noble.stopScanning();
                    }, args.search_time);
                });
        }
        
        private setupBeaconConnect() {
            const beaconsGetter = () => {
                return this.currentBeacon;
            };

            const beacons: Peripheral[] = this.beacons;

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_CONNECT_BEACON, BeaconApi.COMMAND_DESC_CONNECT_BEACON)
                .validate(function(args) {
                    const currentBeacon: Peripheral = <Peripheral>beaconsGetter();

                    let result: string | true;

                    if (!currentBeacon) {
                        result = BeaconApi.VALID_FAIL_DESC_CONNECT_BEACON;
                    } else {
                        result = true
                    }

                    return <string | true>result;
                })
                .action(function(args, callback) {
                    const vI: Vorpal = this.parent;

                    const beacon: Peripheral = <Peripheral>beaconsGetter();

                    vI.log(`Attempting to connect to ${beacon.advertisement.localName} ${beacon.id}`);

                    let connectionResultReported: boolean = false;

                    const connectCallback = (err: string) => {
                        if (connectionResultReported) return;

                        connectionResultReported = true;

                        if (err) {
                            vI.log(err);
                        } else {
                            vI.log("Connection succeeded");
                        }

                        callback();
                    };

                    beacon.connect(connectCallback);

                    beacon.on("connect", connectCallback);
                });
        }
        
        private setupBeaconDisconnect() {
            const beaconsGetter = () => {
                return this.currentBeacon;
            };

            const beacons: Peripheral[] = this.beacons;

            this.vorpalInstance
                .command(BeaconApi.COMMAND_NAME_DISCONNECT_BEACON, BeaconApi.COMMAND_DESC_DISCONNECT_BEACON)
                .validate(function(args) {
                    const currentBeacon: Peripheral = <Peripheral>beaconsGetter();

                    let result: string | true;

                    if (!currentBeacon) {
                        result = BeaconApi.VALID_FAIL_DESC_DISCONNECT_BEACON;
                    } else {
                        result = true
                    }

                    return <string | true>result;
                })
                .action(function(args, callback) {
                    const vI: Vorpal = this.parent;

                    const beacon: Peripheral = <Peripheral>beaconsGetter();

                    vI.log(`Attempting to disconnect to ${beacon.advertisement.localName} ${beacon.id}`);

                    let disconnectionResultReported: boolean = false;

                    const disconnectCallback = () => {
                        if (disconnectionResultReported) return;

                        disconnectionResultReported = true;

                        vI.log("Disconnection succeeded");

                        callback();
                    };

                    beacon.disconnect(disconnectCallback);

                    beacon.on("disconnect", disconnectCallback);
                });
        }

        private setupBeaconInfoGetter() {
            const beacons: Peripheral[] = this.beacons;

            this.vorpalInstance
                .command("get-beacon-info <beacon_id>", "Returns the full data object for the beacon.")
                .validate(function(args) {
                    const id: number | null = <number>args.beacon_id || null;

                    let result: string | true;

                    if (id === null) {
                        result = "No beacon_id provided";
                    } else if (!isString(id)) {
                        result = "beacon_id is not a string, please enter correct beacon_id";
                    } else {
                        result = true;
                    }

                    return <string | true>result;
                })
                .option('-e, --extra', 'Get extra info.')
                .action(function(args, callback) {
                    const vI: Vorpal = this.parent;

                    let callCallbacAfterAsyncCall: boolean = false;

                    if (!beacons.length) {
                        vI.log("No beacons found, please scan for beacons first.");

                    } else {
                        const beacon: Peripheral = <Peripheral>find(beacons, ["id", args.beacon_id ]);

                        if (beacon) {
                            const nobleExtra = (<any>beacon)._noble;
                            delete (<any>beacon)._noble;
                            vI.log("Beacon data\n-----------\n", beacon);
                            (<any>beacon)._noble = nobleExtra;
                            if (args.options["extra"]) {
                                callCallbacAfterAsyncCall = true;

                                vI.log("\n-----------\nBeacon extra data\n-----------\n");
                                beacon.discoverAllServicesAndCharacteristics((error: string, services: Service[], characteristics: Characteristic[]) => {
                                    if (error) {
                                        vI.log(error);
                                    } else {
                                        vI.log("Services\n--------\n", services.join("\n"));
                                        vI.log("\n");
                                        vI.log("Characteristics\n---------------\n", characteristics.join("\n"));
                                    }
                                    callback();
                                })
                            }

                        } else {
                            vI.log("No beacon found with that beacon_id");
                        }
                    }

                    if (!callCallbacAfterAsyncCall) {
                        callback()
                    }
                });
        }

        private static readonly COMMAND_NAME_GET_BEACON: string = "get-current-beacon";
        private static readonly COMMAND_DESC_GET_BEACON: string = "Gets the current beacon summary data";
        private static readonly ACTION_DESC_GET_BEACON: string = "Current Beacon set to: ";
        private static readonly ACTION_DESC_GET_BEACON_NOT_SET: string = "Current Beacon not set!";

        private static readonly COMMAND_NAME_SET_BEACON: string = "set-current-beacon <beacon_id>";
        private static readonly COMMAND_DESC_SET_BEACON: string = "Sets the beacon to operate on.";
        private static readonly VALID_FAIL_DESC_SET_BEACON: string = "Cannot set beacon as beacon not in list of found beacons";
        private static readonly ACTION_DESC_SET_BEACON: string = "Setting beacon: ";

        private static readonly COMMAND_NAME_CONNECT_BEACON: string = "connect-current-beacon";
        private static readonly COMMAND_DESC_CONNECT_BEACON: string = "Connects the beacon to operate on.";
        private static readonly VALID_FAIL_DESC_CONNECT_BEACON: string = "Cannot connect beacon as no current set";
        
        private static readonly COMMAND_NAME_DISCONNECT_BEACON: string = "disconnect-current-beacon";
        private static readonly COMMAND_DESC_DISCONNECT_BEACON: string = "Disconnects the beacon to operate on.";
        private static readonly VALID_FAIL_DESC_DISCONNECT_BEACON: string = "Cannot disconnect beacon as no current set";
        
        private static readonly COMMAND_NAME_FIND_BEACONS: string = "find-beacons <search_time>";
        private static readonly COMMAND_DESC_FIND_BEACONS: string = "Finds any BLE beacons advertising (broadcasting). <search_time> sets how long you wish to scan for devices (in milliseconds).";
        private static readonly VALID_FAIL_DESC_NO_SEARCH_TIME: string = "<search_time> not set. Please set how long you wish to scan for devices.";
        private static readonly VALID_FAIL_DESC_NON_NUM_SEARCH_TIME: string = "<search_time> is not a number. Please enter a numeric value.";
        private static readonly VALID_FAIL_DESC_FIND_BEACONS: string = "Cannot find beacons.";
        private static readonly ACTION_DESC_FIND_BEACONS: string = "Finding beacons: ";
        private static readonly RESULT_DESC_FIND_BEACONS_RESPONDED: string = "Beacons responded: ";
        private static readonly RESULT_DESC_FIND_BEACONS_FAILED: string = "Beacons response: failure: ";

        private beacons: Peripheral[] = [];
        private currentBeacon?: Peripheral;
    }
}