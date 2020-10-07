export const ROUTERS = [];
const EMPTY = {};
const SEGMENTS = Symbol();

export const routeTo = (url) => {
    if (url === getCurrentUrl()) {
        return;
    }
    history.pushState(null, null, url);
    return ROUTERS[0].routeTo(url);
};

export function getCurrentUrl() {
    return `${location.pathname || ''}${location.search || ''}`;
}

function createPathSegments(url) {
    return url.replace(/(^\/+|\/+$)/g, '').split('/').map(segment => {
        if (segment.startsWith(':')) {
            const plus = segment.endsWith('+');
            const star = segment.endsWith('*');
            const ques = segment.endsWith('?');
            const param = segment.substr(1, segment.length - (plus || star || ques ? 1 : 0));
            return {param, plus, star, ques};
            
        } else {
            return segment;
        }
    });
}

export const active = (url, className = 'active') => {
    return url === getCurrentUrl() ? className : '';
}

export class ElementRouter extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        if (ROUTERS.length) {
            throw new DOMException("Only instantiable in a top-level browsing context", "SecurityError");
        }
        ROUTERS.push(this);
        this.routeTo(getCurrentUrl());

        addEventListener('popstate', () => {
            this.routeTo(getCurrentUrl());
        });
    }

    async routeTo(url) {
        this.url = url;
        const element = await this.getMatchingChild([...this.children], this.url);
        if (this.shadowRoot.firstChildElement) {
            this.shadowRoot.firstChildElement.replaceWith(element ?? undefined);

        } else if (element) {
            this.shadowRoot.append(element);
        }
        this.dispatchEvent(new CustomEvent('routechange',{detail:{url:getCurrentUrl()}}))
    }

    async resolveElement(routeEle, properties = {}) {
        let returnEle;

        let importAttr = routeEle.getAttribute('import');
        if (importAttr) {
            await import(importAttr);
        }

        let elementAttr = routeEle.getAttribute('element');
        if (elementAttr) {
            returnEle = document.createElement(elementAttr);
        }

        let redirectAttr = routeEle.getAttribute('redirect');
        if (redirectAttr) {
            routeTo(redirectAttr);
            return null;
        }

        let template = routeEle.children[0];
        if (template && template.nodeName === 'TEMPLATE') {
            return document.importNode(template.content, true);
        }

        for (let prop in properties) {
            returnEle[prop] = properties[prop];
        }
        return returnEle;
    }

    getMatchingChild(children, url) {
        const queryRegex = /(?:\?([^#]*))?(#.*)?$/;
        //const queryParams = url.match(queryRegex);
        url = url.replace(queryRegex, '');
        const urlSegments = createPathSegments(url);

        for (const child of children) {
            const path = child.getAttribute('path');
            if (!path || child.nodeName !== "ELEMENT-ROUTE") {
                break;
            } 

            if (path === '*') {
                return this.resolveElement(child); 
            }

            if (path === url) {
                /** Fast exit if direct match */
                return this.resolveElement(child);
            }
            const pathSegments = child[SEGMENTS] ?? (child[SEGMENTS] = createPathSegments(path));
            const matches = {};

            const max = Math.max(urlSegments.length, pathSegments.length);
            let ret;
            for (let i = 0; i < max; i++) {
                const pathSegment = pathSegments[i];
                if (pathSegment && pathSegment.param) {
                    const param = pathSegment.param;
                    const val = urlSegments[i] || '';
                    if (!val && !pathSegment.star && (!pathSegment.ques || pathSegment.plus)) {
                        ret = false;
                        break;
                    }
                    matches[param] = decodeURIComponent(val);
                    if (pathSegment.plus || pathSegment.star) {
                        matches[param] = urlSegments.slice(i).map(decodeURIComponent).join('/');
                        break;
                    }

                } else if (pathSegments[i] !== urlSegments[i]) {
                    ret = false;
                    break;
                }
                ret = true;
                
            }
            if (ret) {
                return this.resolveElement(child, matches);
            }
        }
    }
}
customElements.define('element-router', ElementRouter);
