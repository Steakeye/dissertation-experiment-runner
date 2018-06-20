import Vorpal from "vorpal";
import {API} from "../definitions/exp-run";

export module exp_run {

    export class ServerApi implements API {

        constructor(private vorpalInstance: Vorpal) {
            this.setupServerGetter();
            this.setupServerSetter();
        }

        public get url(): string { return this.serverUrl; }

        private setupServerGetter() {
            const serverGetter = () => {
                return this.serverUrl;
            };

            this.vorpalInstance
                .command(ServerApi.COMMAND_NAME_GET_SERVER, ServerApi.COMMAND_DESC_GET_SERVER)
                .action(function(args, callback) {
                    const url: string = serverGetter();
                    const message: string = url.length ? `${ServerApi.ACTION_DESC_GET_SERVER}${url}` : ServerApi.ACTION_DESC_GET_SERVER_NOT_SET;

                    this.log(message);

                    callback();
                });
        }

        private setupServerSetter() {
            const serverSetter = (url: string) => {
                this.serverUrl = url;
            };

            this.vorpalInstance
                .command(ServerApi.COMMAND_NAME_SET_SERVER, ServerApi.COMMAND_DESC_SET_SERVER)
                .action(function(args, callback) {
                    this.log(`${ServerApi.ACTION_DESC_SET_SERVER}${args.url}`);
                    serverSetter(<string>args.url);

                    callback();
                });
        }

        private static readonly COMMAND_NAME_GET_SERVER: string = "get-server";
        private static readonly COMMAND_DESC_GET_SERVER: string = "Gets the current server URL";
        private static readonly ACTION_DESC_GET_SERVER: string = "Server URL set to: ";
        private static readonly ACTION_DESC_GET_SERVER_NOT_SET: string = "Server URL not set!";

        private static readonly COMMAND_NAME_SET_SERVER: string = "set-server <url>";
        private static readonly COMMAND_DESC_SET_SERVER: string = "Sets the server URL";
        private static readonly ACTION_DESC_SET_SERVER: string = "Setting server URL to: ";

        private serverUrl: string = "";
    }
}