import { IInputs, IOutputs } from "./generated/ManifestTypes";

const DEFAULT_APP_URL = "https://gc-mission-control.base44.app";

export class MissionControlEmbed implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container: HTMLDivElement;
    private iframe: HTMLIFrameElement;
    private statusEl: HTMLDivElement;
    private loaded = false;

    constructor() {
        // Empty
    }

    public init(
        context: ComponentFramework.Context<IInputs>,
        _notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.container = container;
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.position = "relative";

        this.statusEl = document.createElement("div");
        this.statusEl.style.cssText =
            "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
            "font-family:sans-serif;font-size:13px;color:#666;background:#fafafa;padding:16px;text-align:center;";
        this.statusEl.textContent = "Loading GC Mission Control…";
        this.container.appendChild(this.statusEl);

        const appUrl = context.parameters.appUrl?.raw?.trim() || DEFAULT_APP_URL;

        this.iframe = document.createElement("iframe");
        this.iframe.src = appUrl;
        this.iframe.title = "GC Mission Control";
        this.iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";
        this.iframe.setAttribute(
            "sandbox",
            "allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
        );

        this.iframe.addEventListener("load", () => {
            this.loaded = true;
            this.statusEl.style.display = "none";
        });

        this.container.appendChild(this.iframe);

        // If the app never loads (most commonly because it blocks being framed via
        // X-Frame-Options/CSP frame-ancestors), the iframe fires "load" for its own
        // blocked/error page too in some browsers, so this is a best-effort timeout
        // hint rather than a definitive check - there is no cross-origin way for the
        // host page to know for certain why a cross-origin frame is blank.
        window.setTimeout(() => {
            if (!this.loaded) {
                this.statusEl.textContent =
                    "GC Mission Control did not load. If this app blocks being embedded " +
                    "(X-Frame-Options / Content-Security-Policy), embedding it this way isn't possible " +
                    "and the app needs to be bundled into the control directly instead.";
            }
        }, 8000);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        const appUrl = context.parameters.appUrl?.raw?.trim() || DEFAULT_APP_URL;
        if (this.iframe && this.iframe.src !== appUrl) {
            this.loaded = false;
            this.statusEl.style.display = "flex";
            this.statusEl.textContent = "Loading GC Mission Control…";
            this.iframe.src = appUrl;
        }
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        if (this.iframe) {
            this.iframe.remove();
        }
    }
}
