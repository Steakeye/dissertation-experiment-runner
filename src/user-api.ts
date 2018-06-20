import Vorpal from "vorpal";
import {API} from "../definitions/exp-run";

export module exp_run {

    export class UserApi implements API {

        constructor(private vorpalInstance: Vorpal) {
            this.setupUserGetter();
            this.setupUserSetter();
        }

        public get emailAddress(): string { return this.userEmail; }

        private setupUserGetter() {
            const userGetter = () => {
                return this.userEmail;
            };

            this.vorpalInstance
                .command(UserApi.COMMAND_NAME_GET_SERVER, UserApi.COMMAND_DESC_GET_SERVER)
                .action(function(args, callback) {
                    const emailAddress: string = userGetter();
                    const message: string = emailAddress.length ? `${UserApi.ACTION_DESC_GET_SERVER}${emailAddress}` : UserApi.ACTION_DESC_GET_SERVER_NOT_SET;

                    this.log(message);

                    callback();
                });
        }

        private setupUserSetter() {
            const userSetter = (emailAddress: string) => {
                this.userEmail = emailAddress;
            };

            this.vorpalInstance
                .command(UserApi.COMMAND_NAME_SET_SERVER, UserApi.COMMAND_DESC_SET_SERVER)
                .action(function(args, callback) {
                    this.log(`${UserApi.ACTION_DESC_SET_SERVER}${args.emailAddress}`);
                    userSetter(<string>args.emailAddress);

                    callback();
                });
        }

        private static readonly COMMAND_NAME_GET_SERVER: string = "get-user";
        private static readonly COMMAND_DESC_GET_SERVER: string = "Gets the current user email";
        private static readonly ACTION_DESC_GET_SERVER: string = "User email address set to: ";
        private static readonly ACTION_DESC_GET_SERVER_NOT_SET: string = "User email address not set!";

        private static readonly COMMAND_NAME_SET_SERVER: string = "set-user <email>";
        private static readonly COMMAND_DESC_SET_SERVER: string = "Sets the user email address";
        private static readonly ACTION_DESC_SET_SERVER: string = "Setting user email address to: ";

        private userEmail: string = "";
    }
}