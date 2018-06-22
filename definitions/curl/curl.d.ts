/// <reference types="request" />

declare module "curl" {
    import {CoreOptions, RequestCallback} from "request";

    export function get(url: string, options: CoreOptions, callback: RequestCallback): void;
    export function get(url: string, callback: CoreOptions): void;

    export function post(url: string, body: any, options: CoreOptions, callback: RequestCallback): void
    export function post(url: string, body: any, callback: RequestCallback): void

    export function getJSON(url: string, options: CoreOptions, callback: RequestCallback): void
    export function getJSON(url: string, callback: RequestCallback): void

    export function postJSON(url: string, data: Object, options: CoreOptions, callback: RequestCallback): void
    export function postJSON(url: string, data: Object, callback: RequestCallback): void
}