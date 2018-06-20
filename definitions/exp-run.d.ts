import Vorpal from "vorpal";

export interface API {

}

export interface APICtor {
    new (vorpalInstance: Vorpal): API;
}
