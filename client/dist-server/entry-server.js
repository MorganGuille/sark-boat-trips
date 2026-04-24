import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import * as React3 from "react";
import React3__default, { useState, useEffect, useRef, useMemo } from "react";
import ReactDOMServer from "react-dom/server";
import Calendar from "react-calendar";
import axios from "axios";
import Vimeo from "@u-wave/react-vimeo";
function invariant(value, message) {
  if (value === false || value === null || typeof value === "undefined") {
    throw new Error(message);
  }
}
function warning(cond, message) {
  if (!cond) {
    if (typeof console !== "undefined") console.warn(message);
    try {
      throw new Error(message);
    } catch (e) {
    }
  }
}
function createPath({
  pathname = "/",
  search = "",
  hash = ""
}) {
  if (search && search !== "?")
    pathname += search.charAt(0) === "?" ? search : "?" + search;
  if (hash && hash !== "#")
    pathname += hash.charAt(0) === "#" ? hash : "#" + hash;
  return pathname;
}
function parsePath(path) {
  let parsedPath = {};
  if (path) {
    let hashIndex = path.indexOf("#");
    if (hashIndex >= 0) {
      parsedPath.hash = path.substring(hashIndex);
      path = path.substring(0, hashIndex);
    }
    let searchIndex = path.indexOf("?");
    if (searchIndex >= 0) {
      parsedPath.search = path.substring(searchIndex);
      path = path.substring(0, searchIndex);
    }
    if (path) {
      parsedPath.pathname = path;
    }
  }
  return parsedPath;
}
function matchRoutes(routes, locationArg, basename = "/") {
  return matchRoutesImpl(routes, locationArg, basename, false);
}
function matchRoutesImpl(routes, locationArg, basename, allowPartial) {
  let location = typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
  let pathname = stripBasename(location.pathname || "/", basename);
  if (pathname == null) {
    return null;
  }
  let branches = flattenRoutes(routes);
  rankRouteBranches(branches);
  let matches = null;
  for (let i = 0; matches == null && i < branches.length; ++i) {
    let decoded = decodePath(pathname);
    matches = matchRouteBranch(
      branches[i],
      decoded,
      allowPartial
    );
  }
  return matches;
}
function flattenRoutes(routes, branches = [], parentsMeta = [], parentPath = "", _hasParentOptionalSegments = false) {
  let flattenRoute = (route, index, hasParentOptionalSegments = _hasParentOptionalSegments, relativePath) => {
    let meta = {
      relativePath: relativePath === void 0 ? route.path || "" : relativePath,
      caseSensitive: route.caseSensitive === true,
      childrenIndex: index,
      route
    };
    if (meta.relativePath.startsWith("/")) {
      if (!meta.relativePath.startsWith(parentPath) && hasParentOptionalSegments) {
        return;
      }
      invariant(
        meta.relativePath.startsWith(parentPath),
        `Absolute route path "${meta.relativePath}" nested under path "${parentPath}" is not valid. An absolute child route path must start with the combined path of all its parent routes.`
      );
      meta.relativePath = meta.relativePath.slice(parentPath.length);
    }
    let path = joinPaths([parentPath, meta.relativePath]);
    let routesMeta = parentsMeta.concat(meta);
    if (route.children && route.children.length > 0) {
      invariant(
        // Our types know better, but runtime JS may not!
        // @ts-expect-error
        route.index !== true,
        `Index routes must not have child routes. Please remove all child routes from route path "${path}".`
      );
      flattenRoutes(
        route.children,
        branches,
        routesMeta,
        path,
        hasParentOptionalSegments
      );
    }
    if (route.path == null && !route.index) {
      return;
    }
    branches.push({
      path,
      score: computeScore(path, route.index),
      routesMeta
    });
  };
  routes.forEach((route, index) => {
    if (route.path === "" || !route.path?.includes("?")) {
      flattenRoute(route, index);
    } else {
      for (let exploded of explodeOptionalSegments(route.path)) {
        flattenRoute(route, index, true, exploded);
      }
    }
  });
  return branches;
}
function explodeOptionalSegments(path) {
  let segments = path.split("/");
  if (segments.length === 0) return [];
  let [first, ...rest] = segments;
  let isOptional = first.endsWith("?");
  let required = first.replace(/\?$/, "");
  if (rest.length === 0) {
    return isOptional ? [required, ""] : [required];
  }
  let restExploded = explodeOptionalSegments(rest.join("/"));
  let result = [];
  result.push(
    ...restExploded.map(
      (subpath) => subpath === "" ? required : [required, subpath].join("/")
    )
  );
  if (isOptional) {
    result.push(...restExploded);
  }
  return result.map(
    (exploded) => path.startsWith("/") && exploded === "" ? "/" : exploded
  );
}
function rankRouteBranches(branches) {
  branches.sort(
    (a, b) => a.score !== b.score ? b.score - a.score : compareIndexes(
      a.routesMeta.map((meta) => meta.childrenIndex),
      b.routesMeta.map((meta) => meta.childrenIndex)
    )
  );
}
var paramRe = /^:[\w-]+$/;
var dynamicSegmentValue = 3;
var indexRouteValue = 2;
var emptySegmentValue = 1;
var staticSegmentValue = 10;
var splatPenalty = -2;
var isSplat = (s) => s === "*";
function computeScore(path, index) {
  let segments = path.split("/");
  let initialScore = segments.length;
  if (segments.some(isSplat)) {
    initialScore += splatPenalty;
  }
  if (index) {
    initialScore += indexRouteValue;
  }
  return segments.filter((s) => !isSplat(s)).reduce(
    (score, segment) => score + (paramRe.test(segment) ? dynamicSegmentValue : segment === "" ? emptySegmentValue : staticSegmentValue),
    initialScore
  );
}
function compareIndexes(a, b) {
  let siblings = a.length === b.length && a.slice(0, -1).every((n, i) => n === b[i]);
  return siblings ? (
    // If two routes are siblings, we should try to match the earlier sibling
    // first. This allows people to have fine-grained control over the matching
    // behavior by simply putting routes with identical paths in the order they
    // want them tried.
    a[a.length - 1] - b[b.length - 1]
  ) : (
    // Otherwise, it doesn't really make sense to rank non-siblings by index,
    // so they sort equally.
    0
  );
}
function matchRouteBranch(branch, pathname, allowPartial = false) {
  let { routesMeta } = branch;
  let matchedParams = {};
  let matchedPathname = "/";
  let matches = [];
  for (let i = 0; i < routesMeta.length; ++i) {
    let meta = routesMeta[i];
    let end = i === routesMeta.length - 1;
    let remainingPathname = matchedPathname === "/" ? pathname : pathname.slice(matchedPathname.length) || "/";
    let match = matchPath(
      { path: meta.relativePath, caseSensitive: meta.caseSensitive, end },
      remainingPathname
    );
    let route = meta.route;
    if (!match && end && allowPartial && !routesMeta[routesMeta.length - 1].route.index) {
      match = matchPath(
        {
          path: meta.relativePath,
          caseSensitive: meta.caseSensitive,
          end: false
        },
        remainingPathname
      );
    }
    if (!match) {
      return null;
    }
    Object.assign(matchedParams, match.params);
    matches.push({
      // TODO: Can this as be avoided?
      params: matchedParams,
      pathname: joinPaths([matchedPathname, match.pathname]),
      pathnameBase: normalizePathname(
        joinPaths([matchedPathname, match.pathnameBase])
      ),
      route
    });
    if (match.pathnameBase !== "/") {
      matchedPathname = joinPaths([matchedPathname, match.pathnameBase]);
    }
  }
  return matches;
}
function matchPath(pattern, pathname) {
  if (typeof pattern === "string") {
    pattern = { path: pattern, caseSensitive: false, end: true };
  }
  let [matcher, compiledParams] = compilePath(
    pattern.path,
    pattern.caseSensitive,
    pattern.end
  );
  let match = pathname.match(matcher);
  if (!match) return null;
  let matchedPathname = match[0];
  let pathnameBase = matchedPathname.replace(/(.)\/+$/, "$1");
  let captureGroups = match.slice(1);
  let params = compiledParams.reduce(
    (memo2, { paramName, isOptional }, index) => {
      if (paramName === "*") {
        let splatValue = captureGroups[index] || "";
        pathnameBase = matchedPathname.slice(0, matchedPathname.length - splatValue.length).replace(/(.)\/+$/, "$1");
      }
      const value = captureGroups[index];
      if (isOptional && !value) {
        memo2[paramName] = void 0;
      } else {
        memo2[paramName] = (value || "").replace(/%2F/g, "/");
      }
      return memo2;
    },
    {}
  );
  return {
    params,
    pathname: matchedPathname,
    pathnameBase,
    pattern
  };
}
function compilePath(path, caseSensitive = false, end = true) {
  warning(
    path === "*" || !path.endsWith("*") || path.endsWith("/*"),
    `Route path "${path}" will be treated as if it were "${path.replace(/\*$/, "/*")}" because the \`*\` character must always follow a \`/\` in the pattern. To get rid of this warning, please change the route path to "${path.replace(/\*$/, "/*")}".`
  );
  let params = [];
  let regexpSource = "^" + path.replace(/\/*\*?$/, "").replace(/^\/*/, "/").replace(/[\\.*+^${}|()[\]]/g, "\\$&").replace(
    /\/:([\w-]+)(\?)?/g,
    (match, paramName, isOptional, index, str) => {
      params.push({ paramName, isOptional: isOptional != null });
      if (isOptional) {
        let nextChar = str.charAt(index + match.length);
        if (nextChar && nextChar !== "/") {
          return "/([^\\/]*)";
        }
        return "(?:/([^\\/]*))?";
      }
      return "/([^\\/]+)";
    }
  ).replace(/\/([\w-]+)\?(\/|$)/g, "(/$1)?$2");
  if (path.endsWith("*")) {
    params.push({ paramName: "*" });
    regexpSource += path === "*" || path === "/*" ? "(.*)$" : "(?:\\/(.+)|\\/*)$";
  } else if (end) {
    regexpSource += "\\/*$";
  } else if (path !== "" && path !== "/") {
    regexpSource += "(?:(?=\\/|$))";
  } else ;
  let matcher = new RegExp(regexpSource, caseSensitive ? void 0 : "i");
  return [matcher, params];
}
function decodePath(value) {
  try {
    return value.split("/").map((v) => decodeURIComponent(v).replace(/\//g, "%2F")).join("/");
  } catch (error) {
    warning(
      false,
      `The URL path "${value}" could not be decoded because it is a malformed URL segment. This is probably due to a bad percent encoding (${error}).`
    );
    return value;
  }
}
function stripBasename(pathname, basename) {
  if (basename === "/") return pathname;
  if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
    return null;
  }
  let startIndex = basename.endsWith("/") ? basename.length - 1 : basename.length;
  let nextChar = pathname.charAt(startIndex);
  if (nextChar && nextChar !== "/") {
    return null;
  }
  return pathname.slice(startIndex) || "/";
}
var ABSOLUTE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
function resolvePath(to, fromPathname = "/") {
  let {
    pathname: toPathname,
    search = "",
    hash = ""
  } = typeof to === "string" ? parsePath(to) : to;
  let pathname;
  if (toPathname) {
    toPathname = removeDoubleSlashes(toPathname);
    if (toPathname.startsWith("/")) {
      pathname = resolvePathname(toPathname.substring(1), "/");
    } else {
      pathname = resolvePathname(toPathname, fromPathname);
    }
  } else {
    pathname = fromPathname;
  }
  return {
    pathname,
    search: normalizeSearch(search),
    hash: normalizeHash(hash)
  };
}
function resolvePathname(relativePath, fromPathname) {
  let segments = removeTrailingSlash(fromPathname).split("/");
  let relativeSegments = relativePath.split("/");
  relativeSegments.forEach((segment) => {
    if (segment === "..") {
      if (segments.length > 1) segments.pop();
    } else if (segment !== ".") {
      segments.push(segment);
    }
  });
  return segments.length > 1 ? segments.join("/") : "/";
}
function getInvalidPathError(char, field, dest, path) {
  return `Cannot include a '${char}' character in a manually specified \`to.${field}\` field [${JSON.stringify(
    path
  )}].  Please separate it out to the \`to.${dest}\` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.`;
}
function getPathContributingMatches(matches) {
  return matches.filter(
    (match, index) => index === 0 || match.route.path && match.route.path.length > 0
  );
}
function getResolveToMatches(matches) {
  let pathMatches = getPathContributingMatches(matches);
  return pathMatches.map(
    (match, idx) => idx === pathMatches.length - 1 ? match.pathname : match.pathnameBase
  );
}
function resolveTo(toArg, routePathnames, locationPathname, isPathRelative = false) {
  let to;
  if (typeof toArg === "string") {
    to = parsePath(toArg);
  } else {
    to = { ...toArg };
    invariant(
      !to.pathname || !to.pathname.includes("?"),
      getInvalidPathError("?", "pathname", "search", to)
    );
    invariant(
      !to.pathname || !to.pathname.includes("#"),
      getInvalidPathError("#", "pathname", "hash", to)
    );
    invariant(
      !to.search || !to.search.includes("#"),
      getInvalidPathError("#", "search", "hash", to)
    );
  }
  let isEmptyPath = toArg === "" || to.pathname === "";
  let toPathname = isEmptyPath ? "/" : to.pathname;
  let from;
  if (toPathname == null) {
    from = locationPathname;
  } else {
    let routePathnameIndex = routePathnames.length - 1;
    if (!isPathRelative && toPathname.startsWith("..")) {
      let toSegments = toPathname.split("/");
      while (toSegments[0] === "..") {
        toSegments.shift();
        routePathnameIndex -= 1;
      }
      to.pathname = toSegments.join("/");
    }
    from = routePathnameIndex >= 0 ? routePathnames[routePathnameIndex] : "/";
  }
  let path = resolvePath(to, from);
  let hasExplicitTrailingSlash = toPathname && toPathname !== "/" && toPathname.endsWith("/");
  let hasCurrentTrailingSlash = (isEmptyPath || toPathname === ".") && locationPathname.endsWith("/");
  if (!path.pathname.endsWith("/") && (hasExplicitTrailingSlash || hasCurrentTrailingSlash)) {
    path.pathname += "/";
  }
  return path;
}
var removeDoubleSlashes = (path) => path.replace(/\/\/+/g, "/");
var joinPaths = (paths) => removeDoubleSlashes(paths.join("/"));
var removeTrailingSlash = (path) => path.replace(/\/+$/, "");
var normalizePathname = (pathname) => removeTrailingSlash(pathname).replace(/^\/*/, "/");
var normalizeSearch = (search) => !search || search === "?" ? "" : search.startsWith("?") ? search : "?" + search;
var normalizeHash = (hash) => !hash || hash === "#" ? "" : hash.startsWith("#") ? hash : "#" + hash;
var ErrorResponseImpl = class {
  constructor(status, statusText, data2, internal = false) {
    this.status = status;
    this.statusText = statusText || "";
    this.internal = internal;
    if (data2 instanceof Error) {
      this.data = data2.toString();
      this.error = data2;
    } else {
      this.data = data2;
    }
  }
};
function isRouteErrorResponse(error) {
  return error != null && typeof error.status === "number" && typeof error.statusText === "string" && typeof error.internal === "boolean" && "data" in error;
}
function getRoutePattern(matches) {
  let parts = matches.map((m) => m.route.path).filter(Boolean);
  return joinPaths(parts) || "/";
}
var isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined";
function parseToInfo(_to, basename) {
  let to = _to;
  if (typeof to !== "string" || !ABSOLUTE_URL_REGEX.test(to)) {
    return {
      absoluteURL: void 0,
      isExternal: false,
      to
    };
  }
  let absoluteURL = to;
  let isExternal = false;
  if (isBrowser) {
    try {
      let currentUrl = new URL(window.location.href);
      let targetUrl = to.startsWith("//") ? new URL(currentUrl.protocol + to) : new URL(to);
      let path = stripBasename(targetUrl.pathname, basename);
      if (targetUrl.origin === currentUrl.origin && path != null) {
        to = path + targetUrl.search + targetUrl.hash;
      } else {
        isExternal = true;
      }
    } catch (e) {
      warning(
        false,
        `<Link to="${to}"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.`
      );
    }
  }
  return {
    absoluteURL,
    isExternal,
    to
  };
}
Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
var validMutationMethodsArr = [
  "POST",
  "PUT",
  "PATCH",
  "DELETE"
];
new Set(
  validMutationMethodsArr
);
var validRequestMethodsArr = [
  "GET",
  ...validMutationMethodsArr
];
new Set(validRequestMethodsArr);
var DataRouterContext = React3.createContext(null);
DataRouterContext.displayName = "DataRouter";
var DataRouterStateContext = React3.createContext(null);
DataRouterStateContext.displayName = "DataRouterState";
var RSCRouterContext = React3.createContext(false);
function useIsRSCRouterContext() {
  return React3.useContext(RSCRouterContext);
}
var ViewTransitionContext = React3.createContext({
  isTransitioning: false
});
ViewTransitionContext.displayName = "ViewTransition";
var FetchersContext = React3.createContext(
  /* @__PURE__ */ new Map()
);
FetchersContext.displayName = "Fetchers";
var AwaitContext = React3.createContext(null);
AwaitContext.displayName = "Await";
var NavigationContext = React3.createContext(
  null
);
NavigationContext.displayName = "Navigation";
var LocationContext = React3.createContext(
  null
);
LocationContext.displayName = "Location";
var RouteContext = React3.createContext({
  outlet: null,
  matches: [],
  isDataRoute: false
});
RouteContext.displayName = "Route";
var RouteErrorContext = React3.createContext(null);
RouteErrorContext.displayName = "RouteError";
var ERROR_DIGEST_BASE = "REACT_ROUTER_ERROR";
var ERROR_DIGEST_REDIRECT = "REDIRECT";
var ERROR_DIGEST_ROUTE_ERROR_RESPONSE = "ROUTE_ERROR_RESPONSE";
function decodeRedirectErrorDigest(digest) {
  if (digest.startsWith(`${ERROR_DIGEST_BASE}:${ERROR_DIGEST_REDIRECT}:{`)) {
    try {
      let parsed = JSON.parse(digest.slice(28));
      if (typeof parsed === "object" && parsed && typeof parsed.status === "number" && typeof parsed.statusText === "string" && typeof parsed.location === "string" && typeof parsed.reloadDocument === "boolean" && typeof parsed.replace === "boolean") {
        return parsed;
      }
    } catch {
    }
  }
}
function decodeRouteErrorResponseDigest(digest) {
  if (digest.startsWith(
    `${ERROR_DIGEST_BASE}:${ERROR_DIGEST_ROUTE_ERROR_RESPONSE}:{`
  )) {
    try {
      let parsed = JSON.parse(digest.slice(40));
      if (typeof parsed === "object" && parsed && typeof parsed.status === "number" && typeof parsed.statusText === "string") {
        return new ErrorResponseImpl(
          parsed.status,
          parsed.statusText,
          parsed.data
        );
      }
    } catch {
    }
  }
}
function useHref(to, { relative } = {}) {
  invariant(
    useInRouterContext(),
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    `useHref() may be used only in the context of a <Router> component.`
  );
  let { basename, navigator } = React3.useContext(NavigationContext);
  let { hash, pathname, search } = useResolvedPath(to, { relative });
  let joinedPathname = pathname;
  if (basename !== "/") {
    joinedPathname = pathname === "/" ? basename : joinPaths([basename, pathname]);
  }
  return navigator.createHref({ pathname: joinedPathname, search, hash });
}
function useInRouterContext() {
  return React3.useContext(LocationContext) != null;
}
function useLocation() {
  invariant(
    useInRouterContext(),
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    `useLocation() may be used only in the context of a <Router> component.`
  );
  return React3.useContext(LocationContext).location;
}
var navigateEffectWarning = `You should call navigate() in a React.useEffect(), not when your component is first rendered.`;
function useIsomorphicLayoutEffect(cb) {
  let isStatic = React3.useContext(NavigationContext).static;
  if (!isStatic) {
    React3.useLayoutEffect(cb);
  }
}
function useNavigate() {
  let { isDataRoute } = React3.useContext(RouteContext);
  return isDataRoute ? useNavigateStable() : useNavigateUnstable();
}
function useNavigateUnstable() {
  invariant(
    useInRouterContext(),
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    `useNavigate() may be used only in the context of a <Router> component.`
  );
  let dataRouterContext = React3.useContext(DataRouterContext);
  let { basename, navigator } = React3.useContext(NavigationContext);
  let { matches } = React3.useContext(RouteContext);
  let { pathname: locationPathname } = useLocation();
  let routePathnamesJson = JSON.stringify(getResolveToMatches(matches));
  let activeRef = React3.useRef(false);
  useIsomorphicLayoutEffect(() => {
    activeRef.current = true;
  });
  let navigate = React3.useCallback(
    (to, options = {}) => {
      warning(activeRef.current, navigateEffectWarning);
      if (!activeRef.current) return;
      if (typeof to === "number") {
        navigator.go(to);
        return;
      }
      let path = resolveTo(
        to,
        JSON.parse(routePathnamesJson),
        locationPathname,
        options.relative === "path"
      );
      if (dataRouterContext == null && basename !== "/") {
        path.pathname = path.pathname === "/" ? basename : joinPaths([basename, path.pathname]);
      }
      (!!options.replace ? navigator.replace : navigator.push)(
        path,
        options.state,
        options
      );
    },
    [
      basename,
      navigator,
      routePathnamesJson,
      locationPathname,
      dataRouterContext
    ]
  );
  return navigate;
}
React3.createContext(null);
function useResolvedPath(to, { relative } = {}) {
  let { matches } = React3.useContext(RouteContext);
  let { pathname: locationPathname } = useLocation();
  let routePathnamesJson = JSON.stringify(getResolveToMatches(matches));
  return React3.useMemo(
    () => resolveTo(
      to,
      JSON.parse(routePathnamesJson),
      locationPathname,
      relative === "path"
    ),
    [to, routePathnamesJson, locationPathname, relative]
  );
}
function useRoutes(routes, locationArg) {
  return useRoutesImpl(routes, locationArg);
}
function useRoutesImpl(routes, locationArg, dataRouterOpts) {
  invariant(
    useInRouterContext(),
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    `useRoutes() may be used only in the context of a <Router> component.`
  );
  let { navigator } = React3.useContext(NavigationContext);
  let { matches: parentMatches } = React3.useContext(RouteContext);
  let routeMatch = parentMatches[parentMatches.length - 1];
  let parentParams = routeMatch ? routeMatch.params : {};
  let parentPathname = routeMatch ? routeMatch.pathname : "/";
  let parentPathnameBase = routeMatch ? routeMatch.pathnameBase : "/";
  let parentRoute = routeMatch && routeMatch.route;
  {
    let parentPath = parentRoute && parentRoute.path || "";
    warningOnce(
      parentPathname,
      !parentRoute || parentPath.endsWith("*") || parentPath.endsWith("*?"),
      `You rendered descendant <Routes> (or called \`useRoutes()\`) at "${parentPathname}" (under <Route path="${parentPath}">) but the parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

Please change the parent <Route path="${parentPath}"> to <Route path="${parentPath === "/" ? "*" : `${parentPath}/*`}">.`
    );
  }
  let locationFromContext = useLocation();
  let location;
  if (locationArg) {
    let parsedLocationArg = typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
    invariant(
      parentPathnameBase === "/" || parsedLocationArg.pathname?.startsWith(parentPathnameBase),
      `When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, the location pathname must begin with the portion of the URL pathname that was matched by all parent routes. The current pathname base is "${parentPathnameBase}" but pathname "${parsedLocationArg.pathname}" was given in the \`location\` prop.`
    );
    location = parsedLocationArg;
  } else {
    location = locationFromContext;
  }
  let pathname = location.pathname || "/";
  let remainingPathname = pathname;
  if (parentPathnameBase !== "/") {
    let parentSegments = parentPathnameBase.replace(/^\//, "").split("/");
    let segments = pathname.replace(/^\//, "").split("/");
    remainingPathname = "/" + segments.slice(parentSegments.length).join("/");
  }
  let matches = matchRoutes(routes, { pathname: remainingPathname });
  {
    warning(
      parentRoute || matches != null,
      `No routes matched location "${location.pathname}${location.search}${location.hash}" `
    );
    warning(
      matches == null || matches[matches.length - 1].route.element !== void 0 || matches[matches.length - 1].route.Component !== void 0 || matches[matches.length - 1].route.lazy !== void 0,
      `Matched leaf route at location "${location.pathname}${location.search}${location.hash}" does not have an element or Component. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.`
    );
  }
  let renderedMatches = _renderMatches(
    matches && matches.map(
      (match) => Object.assign({}, match, {
        params: Object.assign({}, parentParams, match.params),
        pathname: joinPaths([
          parentPathnameBase,
          // Re-encode pathnames that were decoded inside matchRoutes.
          // Pre-encode `%`, `?` and `#` ahead of `encodeLocation` because it uses
          // `new URL()` internally and we need to prevent it from treating
          // them as separators
          navigator.encodeLocation ? navigator.encodeLocation(
            match.pathname.replace(/%/g, "%25").replace(/\?/g, "%3F").replace(/#/g, "%23")
          ).pathname : match.pathname
        ]),
        pathnameBase: match.pathnameBase === "/" ? parentPathnameBase : joinPaths([
          parentPathnameBase,
          // Re-encode pathnames that were decoded inside matchRoutes
          // Pre-encode `%`, `?` and `#` ahead of `encodeLocation` because it uses
          // `new URL()` internally and we need to prevent it from treating
          // them as separators
          navigator.encodeLocation ? navigator.encodeLocation(
            match.pathnameBase.replace(/%/g, "%25").replace(/\?/g, "%3F").replace(/#/g, "%23")
          ).pathname : match.pathnameBase
        ])
      })
    ),
    parentMatches,
    dataRouterOpts
  );
  if (locationArg && renderedMatches) {
    return /* @__PURE__ */ React3.createElement(
      LocationContext.Provider,
      {
        value: {
          location: {
            pathname: "/",
            search: "",
            hash: "",
            state: null,
            key: "default",
            unstable_mask: void 0,
            ...location
          },
          navigationType: "POP"
          /* Pop */
        }
      },
      renderedMatches
    );
  }
  return renderedMatches;
}
function DefaultErrorComponent() {
  let error = useRouteError();
  let message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : JSON.stringify(error);
  let stack = error instanceof Error ? error.stack : null;
  let lightgrey = "rgba(200,200,200, 0.5)";
  let preStyles = { padding: "0.5rem", backgroundColor: lightgrey };
  let codeStyles = { padding: "2px 4px", backgroundColor: lightgrey };
  let devInfo = null;
  {
    console.error(
      "Error handled by React Router default ErrorBoundary:",
      error
    );
    devInfo = /* @__PURE__ */ React3.createElement(React3.Fragment, null, /* @__PURE__ */ React3.createElement("p", null, "💿 Hey developer 👋"), /* @__PURE__ */ React3.createElement("p", null, "You can provide a way better UX than this when your app throws errors by providing your own ", /* @__PURE__ */ React3.createElement("code", { style: codeStyles }, "ErrorBoundary"), " or", " ", /* @__PURE__ */ React3.createElement("code", { style: codeStyles }, "errorElement"), " prop on your route."));
  }
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, /* @__PURE__ */ React3.createElement("h2", null, "Unexpected Application Error!"), /* @__PURE__ */ React3.createElement("h3", { style: { fontStyle: "italic" } }, message), stack ? /* @__PURE__ */ React3.createElement("pre", { style: preStyles }, stack) : null, devInfo);
}
var defaultErrorElement = /* @__PURE__ */ React3.createElement(DefaultErrorComponent, null);
var RenderErrorBoundary = class extends React3.Component {
  constructor(props) {
    super(props);
    this.state = {
      location: props.location,
      revalidation: props.revalidation,
      error: props.error
    };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  static getDerivedStateFromProps(props, state) {
    if (state.location !== props.location || state.revalidation !== "idle" && props.revalidation === "idle") {
      return {
        error: props.error,
        location: props.location,
        revalidation: props.revalidation
      };
    }
    return {
      error: props.error !== void 0 ? props.error : state.error,
      location: state.location,
      revalidation: props.revalidation || state.revalidation
    };
  }
  componentDidCatch(error, errorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    } else {
      console.error(
        "React Router caught the following error during render",
        error
      );
    }
  }
  render() {
    let error = this.state.error;
    if (this.context && typeof error === "object" && error && "digest" in error && typeof error.digest === "string") {
      const decoded = decodeRouteErrorResponseDigest(error.digest);
      if (decoded) error = decoded;
    }
    let result = error !== void 0 ? /* @__PURE__ */ React3.createElement(RouteContext.Provider, { value: this.props.routeContext }, /* @__PURE__ */ React3.createElement(
      RouteErrorContext.Provider,
      {
        value: error,
        children: this.props.component
      }
    )) : this.props.children;
    if (this.context) {
      return /* @__PURE__ */ React3.createElement(RSCErrorHandler, { error }, result);
    }
    return result;
  }
};
RenderErrorBoundary.contextType = RSCRouterContext;
var errorRedirectHandledMap = /* @__PURE__ */ new WeakMap();
function RSCErrorHandler({
  children,
  error
}) {
  let { basename } = React3.useContext(NavigationContext);
  if (typeof error === "object" && error && "digest" in error && typeof error.digest === "string") {
    let redirect2 = decodeRedirectErrorDigest(error.digest);
    if (redirect2) {
      let existingRedirect = errorRedirectHandledMap.get(error);
      if (existingRedirect) throw existingRedirect;
      let parsed = parseToInfo(redirect2.location, basename);
      if (isBrowser && !errorRedirectHandledMap.get(error)) {
        if (parsed.isExternal || redirect2.reloadDocument) {
          window.location.href = parsed.absoluteURL || parsed.to;
        } else {
          const redirectPromise = Promise.resolve().then(
            () => window.__reactRouterDataRouter.navigate(parsed.to, {
              replace: redirect2.replace
            })
          );
          errorRedirectHandledMap.set(error, redirectPromise);
          throw redirectPromise;
        }
      }
      return /* @__PURE__ */ React3.createElement(
        "meta",
        {
          httpEquiv: "refresh",
          content: `0;url=${parsed.absoluteURL || parsed.to}`
        }
      );
    }
  }
  return children;
}
function RenderedRoute({ routeContext, match, children }) {
  let dataRouterContext = React3.useContext(DataRouterContext);
  if (dataRouterContext && dataRouterContext.static && dataRouterContext.staticContext && (match.route.errorElement || match.route.ErrorBoundary)) {
    dataRouterContext.staticContext._deepestRenderedBoundaryId = match.route.id;
  }
  return /* @__PURE__ */ React3.createElement(RouteContext.Provider, { value: routeContext }, children);
}
function _renderMatches(matches, parentMatches = [], dataRouterOpts) {
  let dataRouterState = dataRouterOpts?.state;
  if (matches == null) {
    if (!dataRouterState) {
      return null;
    }
    if (dataRouterState.errors) {
      matches = dataRouterState.matches;
    } else if (parentMatches.length === 0 && !dataRouterState.initialized && dataRouterState.matches.length > 0) {
      matches = dataRouterState.matches;
    } else {
      return null;
    }
  }
  let renderedMatches = matches;
  let errors = dataRouterState?.errors;
  if (errors != null) {
    let errorIndex = renderedMatches.findIndex(
      (m) => m.route.id && errors?.[m.route.id] !== void 0
    );
    invariant(
      errorIndex >= 0,
      `Could not find a matching route for errors on route IDs: ${Object.keys(
        errors
      ).join(",")}`
    );
    renderedMatches = renderedMatches.slice(
      0,
      Math.min(renderedMatches.length, errorIndex + 1)
    );
  }
  let renderFallback = false;
  let fallbackIndex = -1;
  if (dataRouterOpts && dataRouterState) {
    renderFallback = dataRouterState.renderFallback;
    for (let i = 0; i < renderedMatches.length; i++) {
      let match = renderedMatches[i];
      if (match.route.HydrateFallback || match.route.hydrateFallbackElement) {
        fallbackIndex = i;
      }
      if (match.route.id) {
        let { loaderData, errors: errors2 } = dataRouterState;
        let needsToRunLoader = match.route.loader && !loaderData.hasOwnProperty(match.route.id) && (!errors2 || errors2[match.route.id] === void 0);
        if (match.route.lazy || needsToRunLoader) {
          if (dataRouterOpts.isStatic) {
            renderFallback = true;
          }
          if (fallbackIndex >= 0) {
            renderedMatches = renderedMatches.slice(0, fallbackIndex + 1);
          } else {
            renderedMatches = [renderedMatches[0]];
          }
          break;
        }
      }
    }
  }
  let onErrorHandler = dataRouterOpts?.onError;
  let onError = dataRouterState && onErrorHandler ? (error, errorInfo) => {
    onErrorHandler(error, {
      location: dataRouterState.location,
      params: dataRouterState.matches?.[0]?.params ?? {},
      unstable_pattern: getRoutePattern(dataRouterState.matches),
      errorInfo
    });
  } : void 0;
  return renderedMatches.reduceRight(
    (outlet, match, index) => {
      let error;
      let shouldRenderHydrateFallback = false;
      let errorElement = null;
      let hydrateFallbackElement = null;
      if (dataRouterState) {
        error = errors && match.route.id ? errors[match.route.id] : void 0;
        errorElement = match.route.errorElement || defaultErrorElement;
        if (renderFallback) {
          if (fallbackIndex < 0 && index === 0) {
            warningOnce(
              "route-fallback",
              false,
              "No `HydrateFallback` element provided to render during initial hydration"
            );
            shouldRenderHydrateFallback = true;
            hydrateFallbackElement = null;
          } else if (fallbackIndex === index) {
            shouldRenderHydrateFallback = true;
            hydrateFallbackElement = match.route.hydrateFallbackElement || null;
          }
        }
      }
      let matches2 = parentMatches.concat(renderedMatches.slice(0, index + 1));
      let getChildren = () => {
        let children;
        if (error) {
          children = errorElement;
        } else if (shouldRenderHydrateFallback) {
          children = hydrateFallbackElement;
        } else if (match.route.Component) {
          children = /* @__PURE__ */ React3.createElement(match.route.Component, null);
        } else if (match.route.element) {
          children = match.route.element;
        } else {
          children = outlet;
        }
        return /* @__PURE__ */ React3.createElement(
          RenderedRoute,
          {
            match,
            routeContext: {
              outlet,
              matches: matches2,
              isDataRoute: dataRouterState != null
            },
            children
          }
        );
      };
      return dataRouterState && (match.route.ErrorBoundary || match.route.errorElement || index === 0) ? /* @__PURE__ */ React3.createElement(
        RenderErrorBoundary,
        {
          location: dataRouterState.location,
          revalidation: dataRouterState.revalidation,
          component: errorElement,
          error,
          children: getChildren(),
          routeContext: { outlet: null, matches: matches2, isDataRoute: true },
          onError
        }
      ) : getChildren();
    },
    null
  );
}
function getDataRouterConsoleError(hookName) {
  return `${hookName} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}
function useDataRouterContext(hookName) {
  let ctx = React3.useContext(DataRouterContext);
  invariant(ctx, getDataRouterConsoleError(hookName));
  return ctx;
}
function useDataRouterState(hookName) {
  let state = React3.useContext(DataRouterStateContext);
  invariant(state, getDataRouterConsoleError(hookName));
  return state;
}
function useRouteContext(hookName) {
  let route = React3.useContext(RouteContext);
  invariant(route, getDataRouterConsoleError(hookName));
  return route;
}
function useCurrentRouteId(hookName) {
  let route = useRouteContext(hookName);
  let thisRoute = route.matches[route.matches.length - 1];
  invariant(
    thisRoute.route.id,
    `${hookName} can only be used on routes that contain a unique "id"`
  );
  return thisRoute.route.id;
}
function useRouteId() {
  return useCurrentRouteId(
    "useRouteId"
    /* UseRouteId */
  );
}
function useRouteError() {
  let error = React3.useContext(RouteErrorContext);
  let state = useDataRouterState(
    "useRouteError"
    /* UseRouteError */
  );
  let routeId = useCurrentRouteId(
    "useRouteError"
    /* UseRouteError */
  );
  if (error !== void 0) {
    return error;
  }
  return state.errors?.[routeId];
}
function useNavigateStable() {
  let { router } = useDataRouterContext(
    "useNavigate"
    /* UseNavigateStable */
  );
  let id = useCurrentRouteId(
    "useNavigate"
    /* UseNavigateStable */
  );
  let activeRef = React3.useRef(false);
  useIsomorphicLayoutEffect(() => {
    activeRef.current = true;
  });
  let navigate = React3.useCallback(
    async (to, options = {}) => {
      warning(activeRef.current, navigateEffectWarning);
      if (!activeRef.current) return;
      if (typeof to === "number") {
        await router.navigate(to);
      } else {
        await router.navigate(to, { fromRouteId: id, ...options });
      }
    },
    [router, id]
  );
  return navigate;
}
var alreadyWarned = {};
function warningOnce(key, cond, message) {
  if (!cond && !alreadyWarned[key]) {
    alreadyWarned[key] = true;
    warning(false, message);
  }
}
React3.memo(DataRoutes);
function DataRoutes({
  routes,
  future,
  state,
  isStatic,
  onError
}) {
  return useRoutesImpl(routes, void 0, { state, isStatic, onError });
}
function Route(props) {
  invariant(
    false,
    `A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.`
  );
}
function Router({
  basename: basenameProp = "/",
  children = null,
  location: locationProp,
  navigationType = "POP",
  navigator,
  static: staticProp = false,
  unstable_useTransitions
}) {
  invariant(
    !useInRouterContext(),
    `You cannot render a <Router> inside another <Router>. You should never have more than one in your app.`
  );
  let basename = basenameProp.replace(/^\/*/, "/");
  let navigationContext = React3.useMemo(
    () => ({
      basename,
      navigator,
      static: staticProp,
      unstable_useTransitions,
      future: {}
    }),
    [basename, navigator, staticProp, unstable_useTransitions]
  );
  if (typeof locationProp === "string") {
    locationProp = parsePath(locationProp);
  }
  let {
    pathname = "/",
    search = "",
    hash = "",
    state = null,
    key = "default",
    unstable_mask
  } = locationProp;
  let locationContext = React3.useMemo(() => {
    let trailingPathname = stripBasename(pathname, basename);
    if (trailingPathname == null) {
      return null;
    }
    return {
      location: {
        pathname: trailingPathname,
        search,
        hash,
        state,
        key,
        unstable_mask
      },
      navigationType
    };
  }, [
    basename,
    pathname,
    search,
    hash,
    state,
    key,
    navigationType,
    unstable_mask
  ]);
  warning(
    locationContext != null,
    `<Router basename="${basename}"> is not able to match the URL "${pathname}${search}${hash}" because it does not start with the basename, so the <Router> won't render anything.`
  );
  if (locationContext == null) {
    return null;
  }
  return /* @__PURE__ */ React3.createElement(NavigationContext.Provider, { value: navigationContext }, /* @__PURE__ */ React3.createElement(LocationContext.Provider, { children, value: locationContext }));
}
function Routes({
  children,
  location
}) {
  return useRoutes(createRoutesFromChildren(children), location);
}
function createRoutesFromChildren(children, parentPath = []) {
  let routes = [];
  React3.Children.forEach(children, (element, index) => {
    if (!React3.isValidElement(element)) {
      return;
    }
    let treePath = [...parentPath, index];
    if (element.type === React3.Fragment) {
      routes.push.apply(
        routes,
        createRoutesFromChildren(element.props.children, treePath)
      );
      return;
    }
    invariant(
      element.type === Route,
      `[${typeof element.type === "string" ? element.type : element.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`
    );
    invariant(
      !element.props.index || !element.props.children,
      "An index route cannot have child routes."
    );
    let route = {
      id: element.props.id || treePath.join("-"),
      caseSensitive: element.props.caseSensitive,
      element: element.props.element,
      Component: element.props.Component,
      index: element.props.index,
      path: element.props.path,
      middleware: element.props.middleware,
      loader: element.props.loader,
      action: element.props.action,
      hydrateFallbackElement: element.props.hydrateFallbackElement,
      HydrateFallback: element.props.HydrateFallback,
      errorElement: element.props.errorElement,
      ErrorBoundary: element.props.ErrorBoundary,
      hasErrorBoundary: element.props.hasErrorBoundary === true || element.props.ErrorBoundary != null || element.props.errorElement != null,
      shouldRevalidate: element.props.shouldRevalidate,
      handle: element.props.handle,
      lazy: element.props.lazy
    };
    if (element.props.children) {
      route.children = createRoutesFromChildren(
        element.props.children,
        treePath
      );
    }
    routes.push(route);
  });
  return routes;
}
var defaultMethod = "get";
var defaultEncType = "application/x-www-form-urlencoded";
function isHtmlElement(object) {
  return typeof HTMLElement !== "undefined" && object instanceof HTMLElement;
}
function isButtonElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "button";
}
function isFormElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "form";
}
function isInputElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "input";
}
function isModifiedEvent(event) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}
function shouldProcessLinkClick(event, target) {
  return event.button === 0 && // Ignore everything but left clicks
  (!target || target === "_self") && // Let browser handle "target=_blank" etc.
  !isModifiedEvent(event);
}
var _formDataSupportsSubmitter = null;
function isFormDataSubmitterSupported() {
  if (_formDataSupportsSubmitter === null) {
    try {
      new FormData(
        document.createElement("form"),
        // @ts-expect-error if FormData supports the submitter parameter, this will throw
        0
      );
      _formDataSupportsSubmitter = false;
    } catch (e) {
      _formDataSupportsSubmitter = true;
    }
  }
  return _formDataSupportsSubmitter;
}
var supportedFormEncTypes = /* @__PURE__ */ new Set([
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain"
]);
function getFormEncType(encType) {
  if (encType != null && !supportedFormEncTypes.has(encType)) {
    warning(
      false,
      `"${encType}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${defaultEncType}"`
    );
    return null;
  }
  return encType;
}
function getFormSubmissionInfo(target, basename) {
  let method;
  let action;
  let encType;
  let formData;
  let body;
  if (isFormElement(target)) {
    let attr = target.getAttribute("action");
    action = attr ? stripBasename(attr, basename) : null;
    method = target.getAttribute("method") || defaultMethod;
    encType = getFormEncType(target.getAttribute("enctype")) || defaultEncType;
    formData = new FormData(target);
  } else if (isButtonElement(target) || isInputElement(target) && (target.type === "submit" || target.type === "image")) {
    let form = target.form;
    if (form == null) {
      throw new Error(
        `Cannot submit a <button> or <input type="submit"> without a <form>`
      );
    }
    let attr = target.getAttribute("formaction") || form.getAttribute("action");
    action = attr ? stripBasename(attr, basename) : null;
    method = target.getAttribute("formmethod") || form.getAttribute("method") || defaultMethod;
    encType = getFormEncType(target.getAttribute("formenctype")) || getFormEncType(form.getAttribute("enctype")) || defaultEncType;
    formData = new FormData(form, target);
    if (!isFormDataSubmitterSupported()) {
      let { name, type, value } = target;
      if (type === "image") {
        let prefix = name ? `${name}.` : "";
        formData.append(`${prefix}x`, "0");
        formData.append(`${prefix}y`, "0");
      } else if (name) {
        formData.append(name, value);
      }
    }
  } else if (isHtmlElement(target)) {
    throw new Error(
      `Cannot submit element that is not <form>, <button>, or <input type="submit|image">`
    );
  } else {
    method = defaultMethod;
    action = null;
    encType = defaultEncType;
    body = target;
  }
  if (formData && encType === "text/plain") {
    body = formData;
    formData = void 0;
  }
  return { action, method: method.toLowerCase(), encType, formData, body };
}
Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
function invariant2(value, message) {
  if (value === false || value === null || typeof value === "undefined") {
    throw new Error(message);
  }
}
function singleFetchUrl(reqUrl, basename, trailingSlashAware, extension) {
  let url = typeof reqUrl === "string" ? new URL(
    reqUrl,
    // This can be called during the SSR flow via PrefetchPageLinksImpl so
    // don't assume window is available
    typeof window === "undefined" ? "server://singlefetch/" : window.location.origin
  ) : reqUrl;
  if (trailingSlashAware) {
    if (url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}_.${extension}`;
    } else {
      url.pathname = `${url.pathname}.${extension}`;
    }
  } else {
    if (url.pathname === "/") {
      url.pathname = `_root.${extension}`;
    } else if (basename && stripBasename(url.pathname, basename) === "/") {
      url.pathname = `${removeTrailingSlash(basename)}/_root.${extension}`;
    } else {
      url.pathname = `${removeTrailingSlash(url.pathname)}.${extension}`;
    }
  }
  return url;
}
async function loadRouteModule(route, routeModulesCache) {
  if (route.id in routeModulesCache) {
    return routeModulesCache[route.id];
  }
  try {
    let routeModule = await import(
      /* @vite-ignore */
      /* webpackIgnore: true */
      route.module
    );
    routeModulesCache[route.id] = routeModule;
    return routeModule;
  } catch (error) {
    console.error(
      `Error loading route module \`${route.module}\`, reloading page...`
    );
    console.error(error);
    if (window.__reactRouterContext && window.__reactRouterContext.isSpaMode && // @ts-expect-error
    void 0) ;
    window.location.reload();
    return new Promise(() => {
    });
  }
}
function isHtmlLinkDescriptor(object) {
  if (object == null) {
    return false;
  }
  if (object.href == null) {
    return object.rel === "preload" && typeof object.imageSrcSet === "string" && typeof object.imageSizes === "string";
  }
  return typeof object.rel === "string" && typeof object.href === "string";
}
async function getKeyedPrefetchLinks(matches, manifest, routeModules) {
  let links = await Promise.all(
    matches.map(async (match) => {
      let route = manifest.routes[match.route.id];
      if (route) {
        let mod = await loadRouteModule(route, routeModules);
        return mod.links ? mod.links() : [];
      }
      return [];
    })
  );
  return dedupeLinkDescriptors(
    links.flat(1).filter(isHtmlLinkDescriptor).filter((link) => link.rel === "stylesheet" || link.rel === "preload").map(
      (link) => link.rel === "stylesheet" ? { ...link, rel: "prefetch", as: "style" } : { ...link, rel: "prefetch" }
    )
  );
}
function getNewMatchesForLinks(page, nextMatches, currentMatches, manifest, location, mode) {
  let isNew = (match, index) => {
    if (!currentMatches[index]) return true;
    return match.route.id !== currentMatches[index].route.id;
  };
  let matchPathChanged = (match, index) => {
    return (
      // param change, /users/123 -> /users/456
      currentMatches[index].pathname !== match.pathname || // splat param changed, which is not present in match.path
      // e.g. /files/images/avatar.jpg -> files/finances.xls
      currentMatches[index].route.path?.endsWith("*") && currentMatches[index].params["*"] !== match.params["*"]
    );
  };
  if (mode === "assets") {
    return nextMatches.filter(
      (match, index) => isNew(match, index) || matchPathChanged(match, index)
    );
  }
  if (mode === "data") {
    return nextMatches.filter((match, index) => {
      let manifestRoute = manifest.routes[match.route.id];
      if (!manifestRoute || !manifestRoute.hasLoader) {
        return false;
      }
      if (isNew(match, index) || matchPathChanged(match, index)) {
        return true;
      }
      if (match.route.shouldRevalidate) {
        let routeChoice = match.route.shouldRevalidate({
          currentUrl: new URL(
            location.pathname + location.search + location.hash,
            window.origin
          ),
          currentParams: currentMatches[0]?.params || {},
          nextUrl: new URL(page, window.origin),
          nextParams: match.params,
          defaultShouldRevalidate: true
        });
        if (typeof routeChoice === "boolean") {
          return routeChoice;
        }
      }
      return true;
    });
  }
  return [];
}
function getModuleLinkHrefs(matches, manifest, { includeHydrateFallback } = {}) {
  return dedupeHrefs(
    matches.map((match) => {
      let route = manifest.routes[match.route.id];
      if (!route) return [];
      let hrefs = [route.module];
      if (route.clientActionModule) {
        hrefs = hrefs.concat(route.clientActionModule);
      }
      if (route.clientLoaderModule) {
        hrefs = hrefs.concat(route.clientLoaderModule);
      }
      if (includeHydrateFallback && route.hydrateFallbackModule) {
        hrefs = hrefs.concat(route.hydrateFallbackModule);
      }
      if (route.imports) {
        hrefs = hrefs.concat(route.imports);
      }
      return hrefs;
    }).flat(1)
  );
}
function dedupeHrefs(hrefs) {
  return [...new Set(hrefs)];
}
function sortKeys(obj) {
  let sorted = {};
  let keys = Object.keys(obj).sort();
  for (let key of keys) {
    sorted[key] = obj[key];
  }
  return sorted;
}
function dedupeLinkDescriptors(descriptors, preloads) {
  let set = /* @__PURE__ */ new Set();
  new Set(preloads);
  return descriptors.reduce((deduped, descriptor) => {
    let key = JSON.stringify(sortKeys(descriptor));
    if (!set.has(key)) {
      set.add(key);
      deduped.push({ key, link: descriptor });
    }
    return deduped;
  }, []);
}
function useDataRouterContext2() {
  let context = React3.useContext(DataRouterContext);
  invariant2(
    context,
    "You must render this element inside a <DataRouterContext.Provider> element"
  );
  return context;
}
function useDataRouterStateContext() {
  let context = React3.useContext(DataRouterStateContext);
  invariant2(
    context,
    "You must render this element inside a <DataRouterStateContext.Provider> element"
  );
  return context;
}
var FrameworkContext = React3.createContext(void 0);
FrameworkContext.displayName = "FrameworkContext";
function useFrameworkContext() {
  let context = React3.useContext(FrameworkContext);
  invariant2(
    context,
    "You must render this element inside a <HydratedRouter> element"
  );
  return context;
}
function usePrefetchBehavior(prefetch, theirElementProps) {
  let frameworkContext = React3.useContext(FrameworkContext);
  let [maybePrefetch, setMaybePrefetch] = React3.useState(false);
  let [shouldPrefetch, setShouldPrefetch] = React3.useState(false);
  let { onFocus, onBlur, onMouseEnter, onMouseLeave, onTouchStart } = theirElementProps;
  let ref = React3.useRef(null);
  React3.useEffect(() => {
    if (prefetch === "render") {
      setShouldPrefetch(true);
    }
    if (prefetch === "viewport") {
      let callback = (entries) => {
        entries.forEach((entry) => {
          setShouldPrefetch(entry.isIntersecting);
        });
      };
      let observer = new IntersectionObserver(callback, { threshold: 0.5 });
      if (ref.current) observer.observe(ref.current);
      return () => {
        observer.disconnect();
      };
    }
  }, [prefetch]);
  React3.useEffect(() => {
    if (maybePrefetch) {
      let id = setTimeout(() => {
        setShouldPrefetch(true);
      }, 100);
      return () => {
        clearTimeout(id);
      };
    }
  }, [maybePrefetch]);
  let setIntent = () => {
    setMaybePrefetch(true);
  };
  let cancelIntent = () => {
    setMaybePrefetch(false);
    setShouldPrefetch(false);
  };
  if (!frameworkContext) {
    return [false, ref, {}];
  }
  if (prefetch !== "intent") {
    return [shouldPrefetch, ref, {}];
  }
  return [
    shouldPrefetch,
    ref,
    {
      onFocus: composeEventHandlers(onFocus, setIntent),
      onBlur: composeEventHandlers(onBlur, cancelIntent),
      onMouseEnter: composeEventHandlers(onMouseEnter, setIntent),
      onMouseLeave: composeEventHandlers(onMouseLeave, cancelIntent),
      onTouchStart: composeEventHandlers(onTouchStart, setIntent)
    }
  ];
}
function composeEventHandlers(theirHandler, ourHandler) {
  return (event) => {
    theirHandler && theirHandler(event);
    if (!event.defaultPrevented) {
      ourHandler(event);
    }
  };
}
function PrefetchPageLinks({ page, ...linkProps }) {
  let rsc = useIsRSCRouterContext();
  let { router } = useDataRouterContext2();
  let matches = React3.useMemo(
    () => matchRoutes(router.routes, page, router.basename),
    [router.routes, page, router.basename]
  );
  if (!matches) {
    return null;
  }
  if (rsc) {
    return /* @__PURE__ */ React3.createElement(RSCPrefetchPageLinksImpl, { page, matches, ...linkProps });
  }
  return /* @__PURE__ */ React3.createElement(PrefetchPageLinksImpl, { page, matches, ...linkProps });
}
function useKeyedPrefetchLinks(matches) {
  let { manifest, routeModules } = useFrameworkContext();
  let [keyedPrefetchLinks, setKeyedPrefetchLinks] = React3.useState([]);
  React3.useEffect(() => {
    let interrupted = false;
    void getKeyedPrefetchLinks(matches, manifest, routeModules).then(
      (links) => {
        if (!interrupted) {
          setKeyedPrefetchLinks(links);
        }
      }
    );
    return () => {
      interrupted = true;
    };
  }, [matches, manifest, routeModules]);
  return keyedPrefetchLinks;
}
function RSCPrefetchPageLinksImpl({
  page,
  matches: nextMatches,
  ...linkProps
}) {
  let location = useLocation();
  let { future } = useFrameworkContext();
  let { basename } = useDataRouterContext2();
  let dataHrefs = React3.useMemo(() => {
    if (page === location.pathname + location.search + location.hash) {
      return [];
    }
    let url = singleFetchUrl(
      page,
      basename,
      future.unstable_trailingSlashAwareDataRequests,
      "rsc"
    );
    let hasSomeRoutesWithShouldRevalidate = false;
    let targetRoutes = [];
    for (let match of nextMatches) {
      if (typeof match.route.shouldRevalidate === "function") {
        hasSomeRoutesWithShouldRevalidate = true;
      } else {
        targetRoutes.push(match.route.id);
      }
    }
    if (hasSomeRoutesWithShouldRevalidate && targetRoutes.length > 0) {
      url.searchParams.set("_routes", targetRoutes.join(","));
    }
    return [url.pathname + url.search];
  }, [
    basename,
    future.unstable_trailingSlashAwareDataRequests,
    page,
    location,
    nextMatches
  ]);
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, dataHrefs.map((href) => /* @__PURE__ */ React3.createElement("link", { key: href, rel: "prefetch", as: "fetch", href, ...linkProps })));
}
function PrefetchPageLinksImpl({
  page,
  matches: nextMatches,
  ...linkProps
}) {
  let location = useLocation();
  let { future, manifest, routeModules } = useFrameworkContext();
  let { basename } = useDataRouterContext2();
  let { loaderData, matches } = useDataRouterStateContext();
  let newMatchesForData = React3.useMemo(
    () => getNewMatchesForLinks(
      page,
      nextMatches,
      matches,
      manifest,
      location,
      "data"
    ),
    [page, nextMatches, matches, manifest, location]
  );
  let newMatchesForAssets = React3.useMemo(
    () => getNewMatchesForLinks(
      page,
      nextMatches,
      matches,
      manifest,
      location,
      "assets"
    ),
    [page, nextMatches, matches, manifest, location]
  );
  let dataHrefs = React3.useMemo(() => {
    if (page === location.pathname + location.search + location.hash) {
      return [];
    }
    let routesParams = /* @__PURE__ */ new Set();
    let foundOptOutRoute = false;
    nextMatches.forEach((m) => {
      let manifestRoute = manifest.routes[m.route.id];
      if (!manifestRoute || !manifestRoute.hasLoader) {
        return;
      }
      if (!newMatchesForData.some((m2) => m2.route.id === m.route.id) && m.route.id in loaderData && routeModules[m.route.id]?.shouldRevalidate) {
        foundOptOutRoute = true;
      } else if (manifestRoute.hasClientLoader) {
        foundOptOutRoute = true;
      } else {
        routesParams.add(m.route.id);
      }
    });
    if (routesParams.size === 0) {
      return [];
    }
    let url = singleFetchUrl(
      page,
      basename,
      future.unstable_trailingSlashAwareDataRequests,
      "data"
    );
    if (foundOptOutRoute && routesParams.size > 0) {
      url.searchParams.set(
        "_routes",
        nextMatches.filter((m) => routesParams.has(m.route.id)).map((m) => m.route.id).join(",")
      );
    }
    return [url.pathname + url.search];
  }, [
    basename,
    future.unstable_trailingSlashAwareDataRequests,
    loaderData,
    location,
    manifest,
    newMatchesForData,
    nextMatches,
    page,
    routeModules
  ]);
  let moduleHrefs = React3.useMemo(
    () => getModuleLinkHrefs(newMatchesForAssets, manifest),
    [newMatchesForAssets, manifest]
  );
  let keyedPrefetchLinks = useKeyedPrefetchLinks(newMatchesForAssets);
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, dataHrefs.map((href) => /* @__PURE__ */ React3.createElement("link", { key: href, rel: "prefetch", as: "fetch", href, ...linkProps })), moduleHrefs.map((href) => /* @__PURE__ */ React3.createElement("link", { key: href, rel: "modulepreload", href, ...linkProps })), keyedPrefetchLinks.map(({ key, link }) => (
    // these don't spread `linkProps` because they are full link descriptors
    // already with their own props
    /* @__PURE__ */ React3.createElement(
      "link",
      {
        key,
        nonce: linkProps.nonce,
        ...link,
        crossOrigin: link.crossOrigin ?? linkProps.crossOrigin
      }
    )
  )));
}
function mergeRefs(...refs) {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        ref.current = value;
      }
    });
  };
}
var isBrowser2 = typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined";
try {
  if (isBrowser2) {
    window.__reactRouterVersion = // @ts-expect-error
    "7.14.1";
  }
} catch (e) {
}
var ABSOLUTE_URL_REGEX2 = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
var Link = React3.forwardRef(
  function LinkWithRef({
    onClick,
    discover = "render",
    prefetch = "none",
    relative,
    reloadDocument,
    replace: replace2,
    unstable_mask,
    state,
    target,
    to,
    preventScrollReset,
    viewTransition,
    unstable_defaultShouldRevalidate,
    ...rest
  }, forwardedRef) {
    let { basename, navigator, unstable_useTransitions } = React3.useContext(NavigationContext);
    let isAbsolute = typeof to === "string" && ABSOLUTE_URL_REGEX2.test(to);
    let parsed = parseToInfo(to, basename);
    to = parsed.to;
    let href = useHref(to, { relative });
    let location = useLocation();
    let maskedHref = null;
    if (unstable_mask) {
      let resolved = resolveTo(
        unstable_mask,
        [],
        location.unstable_mask ? location.unstable_mask.pathname : "/",
        true
      );
      if (basename !== "/") {
        resolved.pathname = resolved.pathname === "/" ? basename : joinPaths([basename, resolved.pathname]);
      }
      maskedHref = navigator.createHref(resolved);
    }
    let [shouldPrefetch, prefetchRef, prefetchHandlers] = usePrefetchBehavior(
      prefetch,
      rest
    );
    let internalOnClick = useLinkClickHandler(to, {
      replace: replace2,
      unstable_mask,
      state,
      target,
      preventScrollReset,
      relative,
      viewTransition,
      unstable_defaultShouldRevalidate,
      unstable_useTransitions
    });
    function handleClick(event) {
      if (onClick) onClick(event);
      if (!event.defaultPrevented) {
        internalOnClick(event);
      }
    }
    let isSpaLink = !(parsed.isExternal || reloadDocument);
    let link = (
      // eslint-disable-next-line jsx-a11y/anchor-has-content
      /* @__PURE__ */ React3.createElement(
        "a",
        {
          ...rest,
          ...prefetchHandlers,
          href: (isSpaLink ? maskedHref : void 0) || parsed.absoluteURL || href,
          onClick: isSpaLink ? handleClick : onClick,
          ref: mergeRefs(forwardedRef, prefetchRef),
          target,
          "data-discover": !isAbsolute && discover === "render" ? "true" : void 0
        }
      )
    );
    return shouldPrefetch && !isAbsolute ? /* @__PURE__ */ React3.createElement(React3.Fragment, null, link, /* @__PURE__ */ React3.createElement(PrefetchPageLinks, { page: href })) : link;
  }
);
Link.displayName = "Link";
var NavLink = React3.forwardRef(
  function NavLinkWithRef({
    "aria-current": ariaCurrentProp = "page",
    caseSensitive = false,
    className: classNameProp = "",
    end = false,
    style: styleProp,
    to,
    viewTransition,
    children,
    ...rest
  }, ref) {
    let path = useResolvedPath(to, { relative: rest.relative });
    let location = useLocation();
    let routerState = React3.useContext(DataRouterStateContext);
    let { navigator, basename } = React3.useContext(NavigationContext);
    let isTransitioning = routerState != null && // Conditional usage is OK here because the usage of a data router is static
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useViewTransitionState(path) && viewTransition === true;
    let toPathname = navigator.encodeLocation ? navigator.encodeLocation(path).pathname : path.pathname;
    let locationPathname = location.pathname;
    let nextLocationPathname = routerState && routerState.navigation && routerState.navigation.location ? routerState.navigation.location.pathname : null;
    if (!caseSensitive) {
      locationPathname = locationPathname.toLowerCase();
      nextLocationPathname = nextLocationPathname ? nextLocationPathname.toLowerCase() : null;
      toPathname = toPathname.toLowerCase();
    }
    if (nextLocationPathname && basename) {
      nextLocationPathname = stripBasename(nextLocationPathname, basename) || nextLocationPathname;
    }
    const endSlashPosition = toPathname !== "/" && toPathname.endsWith("/") ? toPathname.length - 1 : toPathname.length;
    let isActive = locationPathname === toPathname || !end && locationPathname.startsWith(toPathname) && locationPathname.charAt(endSlashPosition) === "/";
    let isPending = nextLocationPathname != null && (nextLocationPathname === toPathname || !end && nextLocationPathname.startsWith(toPathname) && nextLocationPathname.charAt(toPathname.length) === "/");
    let renderProps = {
      isActive,
      isPending,
      isTransitioning
    };
    let ariaCurrent = isActive ? ariaCurrentProp : void 0;
    let className;
    if (typeof classNameProp === "function") {
      className = classNameProp(renderProps);
    } else {
      className = [
        classNameProp,
        isActive ? "active" : null,
        isPending ? "pending" : null,
        isTransitioning ? "transitioning" : null
      ].filter(Boolean).join(" ");
    }
    let style = typeof styleProp === "function" ? styleProp(renderProps) : styleProp;
    return /* @__PURE__ */ React3.createElement(
      Link,
      {
        ...rest,
        "aria-current": ariaCurrent,
        className,
        ref,
        style,
        to,
        viewTransition
      },
      typeof children === "function" ? children(renderProps) : children
    );
  }
);
NavLink.displayName = "NavLink";
var Form = React3.forwardRef(
  ({
    discover = "render",
    fetcherKey,
    navigate,
    reloadDocument,
    replace: replace2,
    state,
    method = defaultMethod,
    action,
    onSubmit,
    relative,
    preventScrollReset,
    viewTransition,
    unstable_defaultShouldRevalidate,
    ...props
  }, forwardedRef) => {
    let { unstable_useTransitions } = React3.useContext(NavigationContext);
    let submit = useSubmit();
    let formAction = useFormAction(action, { relative });
    let formMethod = method.toLowerCase() === "get" ? "get" : "post";
    let isAbsolute = typeof action === "string" && ABSOLUTE_URL_REGEX2.test(action);
    let submitHandler = (event) => {
      onSubmit && onSubmit(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      let submitter = event.nativeEvent.submitter;
      let submitMethod = submitter?.getAttribute("formmethod") || method;
      let doSubmit = () => submit(submitter || event.currentTarget, {
        fetcherKey,
        method: submitMethod,
        navigate,
        replace: replace2,
        state,
        relative,
        preventScrollReset,
        viewTransition,
        unstable_defaultShouldRevalidate
      });
      if (unstable_useTransitions && navigate !== false) {
        React3.startTransition(() => doSubmit());
      } else {
        doSubmit();
      }
    };
    return /* @__PURE__ */ React3.createElement(
      "form",
      {
        ref: forwardedRef,
        method: formMethod,
        action: formAction,
        onSubmit: reloadDocument ? onSubmit : submitHandler,
        ...props,
        "data-discover": !isAbsolute && discover === "render" ? "true" : void 0
      }
    );
  }
);
Form.displayName = "Form";
function getDataRouterConsoleError2(hookName) {
  return `${hookName} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}
function useDataRouterContext3(hookName) {
  let ctx = React3.useContext(DataRouterContext);
  invariant(ctx, getDataRouterConsoleError2(hookName));
  return ctx;
}
function useLinkClickHandler(to, {
  target,
  replace: replaceProp,
  unstable_mask,
  state,
  preventScrollReset,
  relative,
  viewTransition,
  unstable_defaultShouldRevalidate,
  unstable_useTransitions
} = {}) {
  let navigate = useNavigate();
  let location = useLocation();
  let path = useResolvedPath(to, { relative });
  return React3.useCallback(
    (event) => {
      if (shouldProcessLinkClick(event, target)) {
        event.preventDefault();
        let replace2 = replaceProp !== void 0 ? replaceProp : createPath(location) === createPath(path);
        let doNavigate = () => navigate(to, {
          replace: replace2,
          unstable_mask,
          state,
          preventScrollReset,
          relative,
          viewTransition,
          unstable_defaultShouldRevalidate
        });
        if (unstable_useTransitions) {
          React3.startTransition(() => doNavigate());
        } else {
          doNavigate();
        }
      }
    },
    [
      location,
      navigate,
      path,
      replaceProp,
      unstable_mask,
      state,
      target,
      to,
      preventScrollReset,
      relative,
      viewTransition,
      unstable_defaultShouldRevalidate,
      unstable_useTransitions
    ]
  );
}
var fetcherId = 0;
var getUniqueFetcherId = () => `__${String(++fetcherId)}__`;
function useSubmit() {
  let { router } = useDataRouterContext3(
    "useSubmit"
    /* UseSubmit */
  );
  let { basename } = React3.useContext(NavigationContext);
  let currentRouteId = useRouteId();
  let routerFetch = router.fetch;
  let routerNavigate = router.navigate;
  return React3.useCallback(
    async (target, options = {}) => {
      let { action, method, encType, formData, body } = getFormSubmissionInfo(
        target,
        basename
      );
      if (options.navigate === false) {
        let key = options.fetcherKey || getUniqueFetcherId();
        await routerFetch(key, currentRouteId, options.action || action, {
          unstable_defaultShouldRevalidate: options.unstable_defaultShouldRevalidate,
          preventScrollReset: options.preventScrollReset,
          formData,
          body,
          formMethod: options.method || method,
          formEncType: options.encType || encType,
          flushSync: options.flushSync
        });
      } else {
        await routerNavigate(options.action || action, {
          unstable_defaultShouldRevalidate: options.unstable_defaultShouldRevalidate,
          preventScrollReset: options.preventScrollReset,
          formData,
          body,
          formMethod: options.method || method,
          formEncType: options.encType || encType,
          replace: options.replace,
          state: options.state,
          fromRouteId: currentRouteId,
          flushSync: options.flushSync,
          viewTransition: options.viewTransition
        });
      }
    },
    [routerFetch, routerNavigate, basename, currentRouteId]
  );
}
function useFormAction(action, { relative } = {}) {
  let { basename } = React3.useContext(NavigationContext);
  let routeContext = React3.useContext(RouteContext);
  invariant(routeContext, "useFormAction must be used inside a RouteContext");
  let [match] = routeContext.matches.slice(-1);
  let path = { ...useResolvedPath(action ? action : ".", { relative }) };
  let location = useLocation();
  if (action == null) {
    path.search = location.search;
    let params = new URLSearchParams(path.search);
    let indexValues = params.getAll("index");
    let hasNakedIndexParam = indexValues.some((v) => v === "");
    if (hasNakedIndexParam) {
      params.delete("index");
      indexValues.filter((v) => v).forEach((v) => params.append("index", v));
      let qs = params.toString();
      path.search = qs ? `?${qs}` : "";
    }
  }
  if ((!action || action === ".") && match.route.index) {
    path.search = path.search ? path.search.replace(/^\?/, "?index&") : "?index";
  }
  if (basename !== "/") {
    path.pathname = path.pathname === "/" ? basename : joinPaths([basename, path.pathname]);
  }
  return createPath(path);
}
function useViewTransitionState(to, { relative } = {}) {
  let vtContext = React3.useContext(ViewTransitionContext);
  invariant(
    vtContext != null,
    "`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?"
  );
  let { basename } = useDataRouterContext3(
    "useViewTransitionState"
    /* useViewTransitionState */
  );
  let path = useResolvedPath(to, { relative });
  if (!vtContext.isTransitioning) {
    return false;
  }
  let currentPath = stripBasename(vtContext.currentLocation.pathname, basename) || vtContext.currentLocation.pathname;
  let nextPath = stripBasename(vtContext.nextLocation.pathname, basename) || vtContext.nextLocation.pathname;
  return matchPath(path.pathname, nextPath) != null || matchPath(path.pathname, currentPath) != null;
}
function StaticRouter({
  basename,
  children,
  location: locationProp = "/"
}) {
  if (typeof locationProp === "string") {
    locationProp = parsePath(locationProp);
  }
  let action = "POP";
  let location = {
    pathname: locationProp.pathname || "/",
    search: locationProp.search || "",
    hash: locationProp.hash || "",
    state: locationProp.state != null ? locationProp.state : null,
    key: locationProp.key || "default",
    unstable_mask: void 0
  };
  let staticNavigator = getStatelessNavigator();
  return /* @__PURE__ */ React3.createElement(
    Router,
    {
      basename,
      children,
      location,
      navigationType: action,
      navigator: staticNavigator,
      static: true,
      unstable_useTransitions: false
    }
  );
}
function getStatelessNavigator() {
  return {
    createHref,
    encodeLocation,
    push(to) {
      throw new Error(
        `You cannot use navigator.push() on the server because it is a stateless environment. This error was probably triggered when you did a \`navigate(${JSON.stringify(to)})\` somewhere in your app.`
      );
    },
    replace(to) {
      throw new Error(
        `You cannot use navigator.replace() on the server because it is a stateless environment. This error was probably triggered when you did a \`navigate(${JSON.stringify(to)}, { replace: true })\` somewhere in your app.`
      );
    },
    go(delta) {
      throw new Error(
        `You cannot use navigator.go() on the server because it is a stateless environment. This error was probably triggered when you did a \`navigate(${delta})\` somewhere in your app.`
      );
    },
    back() {
      throw new Error(
        `You cannot use navigator.back() on the server because it is a stateless environment.`
      );
    },
    forward() {
      throw new Error(
        `You cannot use navigator.forward() on the server because it is a stateless environment.`
      );
    }
  };
}
function createHref(to) {
  return typeof to === "string" ? to : createPath(to);
}
function encodeLocation(to) {
  let href = typeof to === "string" ? to : createPath(to);
  href = href.replace(/ $/, "%20");
  let encoded = ABSOLUTE_URL_REGEX3.test(href) ? new URL(href) : new URL(href, "http://localhost");
  return {
    pathname: encoded.pathname,
    search: encoded.search,
    hash: encoded.hash
  };
}
var ABSOLUTE_URL_REGEX3 = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
function Navbar() {
  const [stickyClass, setStickyClass] = useState("");
  const stickNavbar = () => {
    if (window !== void 0) {
      let scrollPosition = window.scrollY;
      scrollPosition > 850 ? setStickyClass("sticky-nav") : setStickyClass("");
    }
  };
  useEffect(() => {
    window.addEventListener("scroll", stickNavbar);
    return () => window.removeEventListener("scroll", stickNavbar);
  }, []);
  let currentLoc = useLocation();
  const checkPage = () => {
    return currentLoc.pathname === "/charters" || currentLoc.pathname === "/dashboard" || currentLoc.pathname === "/success" || currentLoc.pathname === "/canceled";
  };
  useEffect(() => {
    checkPage();
  }, [currentLoc]);
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("header", { className: `navbar ${stickyClass}`, children: [
    /* @__PURE__ */ jsx("a", { href: "#main-content", className: "skip-link", children: "Skip to main content" }),
    /* @__PURE__ */ jsxs("nav", { className: "navbar", "aria-label": "Primary Navigation", children: [
      !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#heroBanner", children: "HOME" }) : /* @__PURE__ */ jsx(NavLink, { to: "./", children: "HOME" }),
      !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#theTour", children: "THE TOUR" }) : null,
      !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#charters", children: "CHARTERS" }) : null,
      !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#sarkIsland", children: "SARK ISLAND" }) : null,
      !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#reviews", children: "REVIEWS" }) : null,
      !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#reservations", children: "RESERVATIONS" }) : null
    ] })
  ] }) });
}
function MobileNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };
  let currentLoc = useLocation();
  const checkPage = () => {
    return currentLoc.pathname === "/charters" || currentLoc.pathname === "/dashboard" || currentLoc.pathname === "/success" || currentLoc.pathname === "/canceled";
  };
  return /* @__PURE__ */ jsxs(
    "nav",
    {
      className: `${menuOpen ? "mobileNavOpen" : "mobileNavClosed"}`,
      "aria-label": "Mobile Navigation",
      children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: toggleMenu,
            className: `burgerIcon ${menuOpen && "burgerIconOpen"} `,
            "aria-label": menuOpen ? "Close menu" : "Open menu",
            "aria-expanded": menuOpen,
            "aria-controls": "mobile-menu-links",
            children: "☰"
          }
        ),
        /* @__PURE__ */ jsxs(
          "div",
          {
            id: "mobile-menu-links",
            className: `mobileLinks ${menuOpen ? "linksOpen" : "linksClosed"}`,
            "aria-hidden": !menuOpen,
            children: [
              !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#heroBanner", children: "HOME" }) : /* @__PURE__ */ jsx(NavLink, { to: "./", children: "HOME" }),
              !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#theTour", children: "THE TOUR" }) : null,
              !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#charters", children: "CHARTERS" }) : null,
              !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#sarkIsland", children: "SARK ISLAND" }) : null,
              !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#reviews", children: "REVIEWS" }) : null,
              !checkPage() ? /* @__PURE__ */ jsx("a", { href: "#reservations", children: "RESERVATIONS" }) : null
            ]
          }
        )
      ]
    }
  );
}
function Slideshow({ images, interval = 5e3 }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const startX = useRef(0);
  const endX = useRef(0);
  const activePointerId = useRef(null);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, interval);
    return () => {
      clearInterval(timer);
    };
  }, [images, interval]);
  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  };
  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };
  const handlePointerDown = (e) => {
    startX.current = e.clientX || e.touches[0].clientX;
    activePointerId.current = e.pointerId;
  };
  const handlePointerMove = (e) => {
    if (e.pointerId === activePointerId.current) {
      endX.current = e.clientX || e.touches[0].clientX;
    }
  };
  const handlePointerUp = (e) => {
    if (e.pointerId === activePointerId.current) {
      if (startX.current - endX.current > 10) {
        goToNext();
      } else if (startX.current - endX.current < -10) {
        goToPrevious();
      }
      startX.current = 0;
      endX.current = 0;
      activePointerId.current = null;
    }
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "image-slider",
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerOut: handlePointerUp,
      children: [
        /* @__PURE__ */ jsx("div", { className: "slider-container", children: images.map((image, index) => {
          const isVisible = index === currentIndex || index === (currentIndex + 1) % images.length || index === (currentIndex - 1 + images.length) % images.length;
          return /* @__PURE__ */ jsx(
            "div",
            {
              className: `slide ${index === currentIndex ? "active" : ""}`,
              style: { backgroundImage: isVisible ? `url(${image})` : "none" }
            },
            index
          );
        }) }),
        /* @__PURE__ */ jsxs("div", { className: "slider-controls", children: [
          /* @__PURE__ */ jsx("button", { onClick: goToPrevious, children: `<` }),
          /* @__PURE__ */ jsx("button", { onClick: goToNext, children: `>` })
        ] })
      ]
    }
  );
}
const googleLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEgElEQVR42u2aW2gcVRjHvySbNIn6YEsfRESUttGAl3jObEJsmc6ZNGpbNZl18VIhYkEhKD60ar3gbNJL8uJD8QIKaZvZXOzmIRrTXdGICkWttJWK9S6BZs8mlmSSSDapuY3nQGFD272km92d3Z4f/Jll2R34fefs952BBYFAIBAIBAKBQCBINZYO+bQW3UFVaUdQxS8HiXSAEvw+e93Krq8HCX4iRJzlFkAe5AonESpkYg8zwaOUSBNM3oobgkepig9TgrbwYmSvuIobmXSIS11t2D3O8p2RVYUYIk6FqtJfXGClEiTS8aGayvXZsN1bgkRaiCKSbBGmqIKeBDsyKMvFVJX6WKxUJqhKi0M1ziqwE+eqqkoowQMplY8U4E2wG1SVDqVFnuC37CdP8EvL7OqDlEjv8bNAqAbLIaUSUcVZy95/lqWLEjwWRV4HuzGi4tupimcSHWdURY/ywxDEYHjL3dfxQxI/Cyz5fhPYkSCRPk5QvvVnd3nRsu5di29h3z1BCd4LdmS6p7g6VH/X9zHF+Tgkzp1wlViy7AC7Mh1w9ISPORZHd9/6DZOdvXIR8GuQi/zrh7Vhv2OOFcHimXhn9Y+0Bo9csvpfR46vOcZMoPAZLr40U0dLR+jWip8uduz5oILLIFdhq98VkY8k3F84+8/OsoGginshlwn7C37lwtESPnLDI5AgpGnsIeKZeDXZbNbNRkgHlh9WhQOO+ajyAcfCxGewGhKEeMw24hm3ko3iMf/TdSs/9av/Kdwcc/X9jnPASHcBeDbtO38TpJoL/qJyLho1/oJTmSqA0jxZlvkCBApOZ6oAsj5+7zX9E1D1yQ22aIKTX8Ca3OwBkTH4W6xdMNRfui3tU0A3L6RlCnDYKndH2f6zvt51AezVfJAg23VaurFl4sZ4UfSx6thjcPwspItpf37D5Vu/cPiF7o2nsNdlIcM1V9mprYcVRNHHd8fcBbp5KGMPQ8PHSk4/0LltmMsvyeewQrh1q4h4zMGYDdBjNqT7cdjHirB4om/tl1UddbMR8UiQob2yMqtv7omz+rPqgck1kE7G+ourm3sqvuOi0aMtIK8rqZXhzwqsAPNxmuAnkAmYZC8XjRnDtciue9EHzxUuW143nyYecybuFGgyN0EmcBru25ChTXPR+NHOoHZtK1iQF/++9few+/qdbY3fKk10Ks72H4BMgrz1L3LBBMMnxB/YcL3NBOvY60qpvW4D6nQ7JW99Pd8p2NBOLv281P7435tbzvwZ7Qmwpnn0Tsg0TKYtunTy4bvs/oMdP1yhCLvADsiHG4r52GOxUpnKD/ccV5rOz108+HQDWHlgF9YdfHBVpCmmMEd2/CLv//0jfjYAuyF/JTuw4dqHDG0+VQXg/cPtcxeAncHtbpk3uxUWD93X4doO2QKf+8j72POsEEPJiCOvaxQbml7uc18P2Qj/WfD5zyS6mNB4YuLaFBPvY2mo8rlLIGewIA973WWoQ3uKZRcytP3Iq73LhFvZ9Q3+Pm53VfCiiT8VCgQCgUAgEAgEglTyP0pCGaB5wkxdAAAAAElFTkSuQmCC";
const tripLogo = "data:image/png;base64,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";
const faceLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAflBMVEUAAAAAf387WZg5WZg6WZcAAP88WJk6WZc6WJc6WJg6WZg7WJk7V5c/P386WZg6WZc5VpY7WJg7WJczVZk6WJg+WZc7WZc2W5o7WZc6WZc7WZc6WZg6WZc6WZg6WZc8WZc8WZk8VZ08V5Y5WpQ4VY0/X589XJo6WJg6WZc7WZgNhgwkAAAAKXRSTlMAAo5h2QE3frLMonNABOePLP2eD90l5RzF4fX46r+Uaj8VXR8JCCFcyGwVUj8AAACSSURBVHja7dS3GcJgEIPhOxNNDia7Ilr7D8QQLECH/8r4rFbfAO+jSvanwXA0zk9n/LJQ3uujLg4cjgAD7PaggG0BDtiAA1ZrEliCA+YLEpiBBKYsMGGBHGnV9Xa3WAWSMrdwJeoqt3gX1L2sQ0h6ssCDBayhzFokIBDaVLILXAANfN4k4CbA9UgCBAgQIEBAY1+a9UBxCDiSwwAAAABJRU5ErkJggg==";
function Reviews() {
  return (
    /* 1. REGION LANDMARK: Labeling the section so it appears in landmark menus */
    /* @__PURE__ */ jsxs("section", { id: "reviews", className: "reviews centered-section", "aria-labelledby": "reviews-heading", children: [
      /* @__PURE__ */ jsx("h2", { id: "reviews-heading", children: "REVIEWS" }),
      /* @__PURE__ */ jsxs("div", { className: "reviewsContainer", children: [
        /* @__PURE__ */ jsx("a", { href: "https://g.co/kgs/xgNzzxD", target: "_blank", rel: "noopener noreferrer", "aria-label": "Read our reviews on Google", children: /* @__PURE__ */ jsxs("div", { className: "reviewCard", children: [
          /* @__PURE__ */ jsx("img", { src: googleLogo, alt: "" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { children: "Google" }),
            /* @__PURE__ */ jsxs("span", { "aria-label": "5.0 out of 5 stars", children: [
              /* @__PURE__ */ jsx("p", { "aria-hidden": "true", children: "5.0" }),
              /* @__PURE__ */ jsx("p", { className: "gold", "aria-hidden": "true", children: " ★★★★★" })
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx("a", { href: "https://www.tripadvisor.com/Attraction_Review-g186231-d6673939-Reviews-Sark_Boat_Trips-Sark_Channel_Islands.html", target: "_blank", rel: "noopener noreferrer", "aria-label": "Read our reviews on Tripadvisor", children: /* @__PURE__ */ jsxs("div", { className: "reviewCard", children: [
          /* @__PURE__ */ jsx("img", { src: tripLogo, alt: "" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { children: "Tripadvisor" }),
            /* @__PURE__ */ jsxs("span", { "aria-label": "5.0 out of 5 stars", children: [
              /* @__PURE__ */ jsx("p", { "aria-hidden": "true", children: "5.0" }),
              /* @__PURE__ */ jsx("p", { className: "gold", "aria-hidden": "true", children: " ★★★★★" })
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx("a", { href: "https://www.facebook.com/sarkboattrips/reviews", target: "_blank", rel: "noopener noreferrer", "aria-label": "Read our reviews on Facebook", children: /* @__PURE__ */ jsxs("div", { className: "reviewCard", children: [
          /* @__PURE__ */ jsx("img", { src: faceLogo, alt: "" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { children: "Facebook" }),
            /* @__PURE__ */ jsxs("span", { "aria-label": "5.0 out of 5 stars", children: [
              /* @__PURE__ */ jsx("p", { "aria-hidden": "true", children: "5.0" }),
              /* @__PURE__ */ jsx("p", { className: "gold", "aria-hidden": "true", children: " ★★★★★" })
            ] })
          ] })
        ] }) })
      ] })
    ] })
  );
}
const URL$1 = `https://secret-eyrie-44762-a52d7fb9dbaa.herokuapp.com`;
function MyCalendar({ setSelectedDate, seasonStartDate, seasonEndDate }) {
  const [date, setDate] = useState(/* @__PURE__ */ new Date());
  const [availability, setAvailability] = useState({});
  let currentLoc = useLocation();
  const formatDate = (date2) => {
    const year = date2.getFullYear();
    const month = `0${date2.getMonth() + 1}`.slice(-2);
    const day = `0${date2.getDate()}`.slice(-2);
    return `${day}-${month}-${year}`;
  };
  const dbseasonStartDate = useMemo(() => {
    if (currentLoc.pathname === "/dashboard") return null;
    if (!seasonStartDate) return null;
    return new Date(seasonStartDate);
  }, [currentLoc.pathname, seasonStartDate]);
  const dbseasonEndDate = useMemo(() => {
    if (currentLoc.pathname === "/dashboard") return null;
    if (!seasonEndDate) return null;
    return new Date(seasonEndDate);
  }, [currentLoc.pathname, seasonEndDate]);
  const fetchMonthAvailability = async (date2) => {
    const year = date2.getFullYear();
    const month = date2.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const dates = [];
    for (let day = firstDayOfMonth.getDate(); day <= lastDayOfMonth.getDate(); day++) {
      const currentDate = new Date(year, month, day);
      dates.push(formatDate(currentDate));
    }
    try {
      const res = await axios.post(`${URL$1}/bookings/monthAvailability`, { dates });
      const availabilityData = res.data.data;
      const newAvailability = {};
      dates.forEach((formattedDate, index) => {
        if (availabilityData[index]) {
          newAvailability[formattedDate] = {
            "11am": availabilityData[index]["11am"],
            "2pm": availabilityData[index]["2pm"]
          };
        } else {
          newAvailability[formattedDate] = null;
        }
      });
      setAvailability(newAvailability);
    } catch (error) {
      console.error(error);
      const newAvailability = {};
      dates.forEach((formattedDate) => {
        newAvailability[formattedDate] = null;
      });
      setAvailability(newAvailability);
    }
  };
  useEffect(() => {
    fetchMonthAvailability(date);
  }, [date]);
  const handleDateChange = (date2) => {
    setDate(date2);
    setSelectedDate(formatDate(date2));
  };
  const setTileClassName = ({ date: date2, view }) => {
    if (view === "month") {
      const formattedDate = formatDate(date2);
      const tileAvailability = availability[formattedDate];
      if (!tileAvailability) return null;
      const available11am = tileAvailability["11am"];
      const available2pm = tileAvailability["2pm"];
      if (available11am === 0 && available2pm === 0) return "fully-booked";
      if (available11am < 12 || available2pm < 12) return "partially-booked";
      return "available";
    }
    return null;
  };
  const setTileContent = ({ date: date2, view }) => {
    if (view === "month") {
      const formattedDate = formatDate(date2);
      const tileAvailability = availability[formattedDate];
      if (tileAvailability) {
        return /* @__PURE__ */ jsxs("span", { className: "sr-only", children: [
          tileAvailability["11am"],
          " spaces at 11am, ",
          tileAvailability["2pm"],
          " spaces at 2pm."
        ] });
      }
    }
    return null;
  };
  const color11am = () => availability[formatDate(date)]?.["11am"] > 6 ? "green" : "darkred";
  const color2pm = () => availability[formatDate(date)]?.["2pm"] > 6 ? "green" : "darkred";
  return /* @__PURE__ */ jsxs("section", { className: "calendar-container", "aria-label": "Trip Availability Calendar", children: [
    /* @__PURE__ */ jsx("div", { className: "calendar-wrapper", children: /* @__PURE__ */ jsx(
      Calendar,
      {
        onActiveStartDateChange: ({ activeStartDate }) => handleDateChange(activeStartDate),
        onChange: handleDateChange,
        onClickDay: handleDateChange,
        value: date,
        tileClassName: setTileClassName,
        tileContent: setTileContent,
        showNeighboringMonth: true,
        maxDetail: "month",
        minDetail: "year",
        next2Label: null,
        prev2Label: null,
        minDate: dbseasonStartDate,
        maxDate: dbseasonEndDate,
        inputRef: (ref) => ref && ref.setAttribute("aria-label", "Select a date for your boat trip")
      }
    ) }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "calendarDisplay",
        "aria-live": "polite",
        "aria-atomic": "true",
        children: [
          /* @__PURE__ */ jsxs("p", { children: [
            "Availability for : ",
            date.toDateString(),
            ":"
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "11:00 AM: " }),
            /* @__PURE__ */ jsx("span", { style: { color: color11am() }, children: !availability[formatDate(date)] && availability[formatDate(date)] !== 0 ? /* @__PURE__ */ jsx("span", { className: "loader", "aria-label": "Loading spaces" }) : `${availability[formatDate(date)]?.["11am"]} spaces available` })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "2:00 PM: " }),
            /* @__PURE__ */ jsx("span", { style: { color: color2pm() }, children: !availability[formatDate(date)] && availability[formatDate(date)] !== 0 ? /* @__PURE__ */ jsx("span", { className: "loader", "aria-label": "Loading spaces" }) : `${availability[formatDate(date)]?.["2pm"]} spaces available` })
          ] })
        ]
      }
    )
  ] });
}
function BookingForm({ selectedDate }) {
  let currentLoc = useLocation();
  const checkPageDashboard = () => {
    return currentLoc.pathname === "/dashboard";
  };
  const checkPageCharters = () => {
    return currentLoc.pathname === "/charters";
  };
  const [showResponse, setResponse] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addBooking = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    let newBooking = {
      timeslot: e.target.timeslot.value,
      firstName: e.target.firstName.value,
      lastName: e.target.lastName.value,
      email: e.target.email.value,
      phone: e.target.phone.value,
      adults: e.target.adults.value,
      children: e.target.children.value,
      date: selectedDate,
      accommodation: e.target.accommodation.value,
      message: e.target.message.value,
      charter: "false"
    };
    try {
      let response = await axios.post(`${URL$1}/bookings/add`, newBooking);
      setResponse(response.data.data);
    } catch (error) {
      console.log(error);
    } finally {
      setIsSubmitting(false);
      e.target.reset();
    }
  };
  const addCharterBooking = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    let newBooking = {
      timeslot: e.target.timeslot.value,
      firstName: e.target.firstName.value,
      lastName: e.target.lastName.value,
      email: e.target.email.value,
      phone: e.target.phone.value,
      adults: e.target.adults.value,
      children: e.target.children.value,
      date: selectedDate,
      accommodation: e.target.accommodation.value,
      message: e.target.message.value,
      charter: "true"
    };
    try {
      const response = await axios.post(`${URL$1}/charters/create-checkout-session`, newBooking);
      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        setResponse(response.data.data);
        console.log(response.data.data);
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const updateBooking = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    let bookingId = e.target._id.value;
    let updatedBooking = {
      timeslot: e.target.timeslot.value,
      firstName: e.target.firstName.value,
      lastName: e.target.lastName.value,
      email: e.target.email.value,
      phone: e.target.phone.value,
      adults: e.target.adults.value,
      children: e.target.children.value,
      date: e.target.date.value,
      accommodation: e.target.accommodation.value,
      message: e.target.message.value,
      charter: e.target.charter.value
    };
    try {
      const response = await axios.post(`${URL$1}/bookings/update/${bookingId}`, updatedBooking);
      console.log(response.data);
      setResponse(response.data.data);
    } catch (error) {
      console.log(error);
    } finally {
      setIsSubmitting(false);
      e.target.reset();
    }
  };
  const actionOnClick = (e) => {
    if (!updating && !checkPageCharters()) {
      return addBooking(e);
    } else if (updating && checkPageDashboard()) {
      return updateBooking(e);
    } else if (checkPageCharters()) {
      return addCharterBooking(e);
    } else {
      e.preventDefault();
      console.log("Error");
    }
  };
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("section", { "aria-label": "Booking Form Section", children: [
    checkPageDashboard() && /* @__PURE__ */ jsx(
      "button",
      {
        className: "btn",
        onClick: () => setUpdating(!updating),
        children: updating ? "Switch to Add New" : "Switch to Update Existing"
      }
    ),
    /* @__PURE__ */ jsxs(
      "form",
      {
        className: "bookingForm",
        onSubmit: (e) => actionOnClick(e),
        "aria-label": updating ? "Update existing booking" : "Request a new booking",
        children: [
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs("span", { children: [
            "Required fields are followed by ",
            /* @__PURE__ */ jsx("strong", { children: /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "*" }) })
          ] }) }),
          updating ? /* @__PURE__ */ jsxs("fieldset", { children: [
            /* @__PURE__ */ jsx("legend", { children: "Update Settings" }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("label", { htmlFor: "_id", children: [
                "Booking ID ",
                /* @__PURE__ */ jsx("strong", { children: "*" })
              ] }),
              /* @__PURE__ */ jsx("input", { type: "text", id: "_id", name: "_id", required: true, placeholder: "Paste ID here" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { htmlFor: "date", children: "New Date" }),
              /* @__PURE__ */ jsx("input", { type: "text", id: "date", name: "date", placeholder: "dd-mm-yyyy" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { htmlFor: "charter", children: "Status" }),
              /* @__PURE__ */ jsxs("select", { id: "charter", name: "charter", children: [
                /* @__PURE__ */ jsx("option", { value: "false", children: "Standard Tour" }),
                /* @__PURE__ */ jsx("option", { value: "true", children: "Charter Trip" })
              ] })
            ] })
          ] }) : null,
          /* @__PURE__ */ jsxs("fieldset", { children: [
            /* @__PURE__ */ jsx("legend", { children: "Contact Information" }),
            /* @__PURE__ */ jsx("div", { role: "status", "aria-live": "polite", children: /* @__PURE__ */ jsx("p", { style: { backgroundColor: "lightgreen", padding: "5px" }, children: `You are booking ${checkPageCharters() ? "a private charter" : "a tour"} for ${selectedDate}` }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("label", { htmlFor: "timeslot", children: [
                "Preferred time ",
                /* @__PURE__ */ jsx("strong", { children: "*" })
              ] }),
              /* @__PURE__ */ jsxs("select", { id: "timeslot", name: "timeslot", defaultValue: "11am", required: !checkPageDashboard(), children: [
                /* @__PURE__ */ jsx("option", { value: "11am", children: "11am" }),
                /* @__PURE__ */ jsx("option", { value: "2pm", children: "2pm" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("label", { htmlFor: "firstName", children: [
                "First Name ",
                /* @__PURE__ */ jsx("strong", { children: "*" })
              ] }),
              /* @__PURE__ */ jsx("input", { type: "text", id: "firstName", name: "firstName", placeholder: "John", required: !checkPageDashboard(), autoComplete: "given-name" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("label", { htmlFor: "lastName", children: [
                "Last Name ",
                /* @__PURE__ */ jsx("strong", { children: "*" })
              ] }),
              /* @__PURE__ */ jsx("input", { type: "text", id: "lastName", name: "lastName", placeholder: "Smith", required: !checkPageDashboard(), autoComplete: "family-name" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("label", { htmlFor: "email", children: [
                "Email ",
                /* @__PURE__ */ jsx("strong", { children: "*" })
              ] }),
              /* @__PURE__ */ jsx("input", { type: "email", id: "email", name: "email", placeholder: "yourname@email.com", required: !checkPageDashboard(), autoComplete: "email" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("label", { htmlFor: "phone", children: [
                "Phone number ",
                /* @__PURE__ */ jsx("strong", { children: "*" })
              ] }),
              /* @__PURE__ */ jsx("input", { type: "tel", id: "phone", name: "phone", placeholder: "(Include country code)", required: !checkPageDashboard(), autoComplete: "tel" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { htmlFor: "accommodation", children: "Accommodation" }),
              /* @__PURE__ */ jsx("input", { type: "text", id: "accommodation", name: "accommodation", placeholder: "Where are you staying on Sark?" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("fieldset", { children: [
            /* @__PURE__ */ jsx("legend", { children: "Party Details" }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("label", { htmlFor: "adults", children: [
                "Number of adults ",
                /* @__PURE__ */ jsx("strong", { children: "*" })
              ] }),
              /* @__PURE__ */ jsx("input", { type: "number", min: "1", max: "12", id: "adults", name: "adults", placeholder: "max 12", required: !checkPageDashboard() })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { htmlFor: "children", children: "Number of children (14yrs and under)" }),
              /* @__PURE__ */ jsx("input", { type: "number", min: "0", max: "12", id: "children", name: "children", placeholder: "including infants" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { htmlFor: "message", children: "Any further info / Special requirements" }),
              /* @__PURE__ */ jsx("textarea", { id: "message", name: "message", cols: "40", rows: "4", placeholder: "e.g. mobility needs" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "btn", type: "submit", disabled: isSubmitting, children: isSubmitting ? /* @__PURE__ */ jsx("span", { className: "submitter", "aria-label": "Submitting..." }) : "Confirm Booking" })
        ]
      }
    ),
    showResponse != null && /* @__PURE__ */ jsx("div", { className: "responseBackdrop", role: "dialog", "aria-labelledby": "response-message", "aria-modal": "true", children: /* @__PURE__ */ jsxs("div", { className: "responseDisplay", children: [
      /* @__PURE__ */ jsx("h3", { id: "response-message", children: showResponse }),
      /* @__PURE__ */ jsx("button", { className: "btn", onClick: () => setResponse(null), autoFocus: true, children: "Dismiss" })
    ] }) })
  ] }) });
}
const getSeasonDates = async () => {
  const res = await axios.get(`${URL$1}/admin/getSeasonDates`);
  return res.data;
};
function Bookings() {
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = `0${date.getMonth() + 1}`.slice(-2);
    const day = `0${date.getDate()}`.slice(-2);
    return `${day}-${month}-${year}`;
  };
  const [selectedDate, setSelectedDate] = useState(formatDate(/* @__PURE__ */ new Date()));
  const [seasonStartDate, setSeasonStartDate] = useState("");
  const [seasonEndDate, setSeasonEndDate] = useState("");
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const res = await getSeasonDates();
        if (res) {
          setSeasonStartDate(res.seasonStartDate);
          setSeasonEndDate(res.seasonEndDate);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchDates();
  }, []);
  if (!seasonStartDate || !seasonEndDate) {
    return /* @__PURE__ */ jsx("div", { "aria-live": "polite", "aria-busy": "true", children: "Loading calendar…" });
  }
  return /* @__PURE__ */ jsxs("section", { className: "bookings", "aria-label": "Booking and Availability", children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h2", { className: "textArea", children: "Make a Reservation" }),
      /* @__PURE__ */ jsx("p", { className: "textArea", children: "Please use the calendar to select a date and then fill out the form to make a booking" }),
      /* @__PURE__ */ jsxs("div", { className: "textArea", "aria-label": "Pricing information", children: [
        /* @__PURE__ */ jsx("p", { children: "Prices for 2026 are :" }),
        /* @__PURE__ */ jsxs("p", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Adults" }),
          ": £40",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx("strong", { children: "Children" }),
          " (3-14 yrs): £25",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx("strong", { children: "Infants" }),
          ": free"
        ] }),
        /* @__PURE__ */ jsxs("p", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Private Charter" }),
          ": £400"
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        MyCalendar,
        {
          setSelectedDate,
          seasonStartDate,
          seasonEndDate
        }
      )
    ] }),
    /* @__PURE__ */ jsx(BookingForm, { selectedDate })
  ] });
}
const placeholderImg = "/assets/video-placeholder-DPluKd_7.webp";
function VideoPlayer() {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const handleInitialPlay = () => {
    setHasLoaded(true);
    setIsPlaying(true);
  };
  const togglePause = () => {
    if (hasLoaded) {
      setIsPlaying(!isPlaying);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "video-container", children: [
    !hasLoaded && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("button", { onClick: handleInitialPlay, className: "custom-play-btn", children: "Play Video" }),
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "video-placeholder",
          style: { backgroundImage: `url(${placeholderImg})` }
        }
      )
    ] }),
    hasLoaded && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        Vimeo,
        {
          className: "videoPlayer",
          video: "https://vimeo.com/331613265",
          paused: !isPlaying,
          muted: true,
          background: true,
          loop: true,
          responsive: true
        }
      ),
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "click-overlay",
          onClick: togglePause
        }
      )
    ] })
  ] });
}
const gallery1 = "/assets/gallery1-Ch3Pz4Ix.webp";
const gallery2 = "/assets/gallery2-DYWD-wY0.webp";
const gallery3 = "/assets/gallery3-CTcfw_Z7.webp";
const gallery4 = "/assets/gallery4-CWoccTKt.webp";
const gallery5 = "/assets/gallery5-Bt5GmFz7.webp";
const gallery6 = "/assets/gallery6-BQVKhkpX.webp";
const gallery7 = "/assets/gallery7-CLu3-LRc.webp";
const gallery8 = "/assets/gallery8-trl8Zogf.webp";
const gallery9 = "/assets/gallery9-gu9XnqTu.webp";
const gallery10 = "/assets/gallery10-DWgTHhDF.webp";
const gallery11 = "/assets/gallery11-9cZYrAYV.webp";
const charters = "/assets/charters-CuL-VIhQ.webp";
const sarkShipping = "/assets/isle-of-sark-shipping-company-2xQAbQ08.webp";
const suesbnb = "/assets/SuesbnbextGeorge-BhCwF8SH.webp";
function Home() {
  const images = [
    gallery1,
    gallery2,
    gallery3,
    gallery4,
    gallery5,
    gallery6,
    gallery7,
    gallery8,
    gallery9,
    gallery10,
    gallery11
  ];
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("title", { children: "Sark Boat Trips" }),
    /* @__PURE__ */ jsx("meta", { name: "description", content: "Explore the beautiful coastline of Sark with Sark Boat Trips unforgettable boat tours. Discover stunning scenery, exciting marine life and create lasting memories. Book now!" }),
    /* @__PURE__ */ jsx("meta", { name: "keywords", content: "boat tours, Sark boat trips, birdwatching tours, dolphin watching, private boat charters, family friendly tours" }),
    /* @__PURE__ */ jsxs("main", { id: "main-content", children: [
      /* @__PURE__ */ jsxs("section", { id: "heroBanner", className: "hero-banner", "aria-label": "Hero", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("h1", { children: "THE BEST WAY TO SEE SARK" }),
          /* @__PURE__ */ jsx("h2", { children: "BOAT TOURS WITH SARK LOCALS" })
        ] }),
        /* @__PURE__ */ jsx("a", { href: "#reservations", children: /* @__PURE__ */ jsxs("button", { className: "cssbuttons-io-button", "aria-label": "Book your tour now", children: [
          "Book now!",
          /* @__PURE__ */ jsx("div", { className: "icon", "aria-hidden": "true", children: /* @__PURE__ */ jsxs(
            "svg",
            {
              height: "24",
              width: "24",
              viewBox: "0 0 24 24",
              xmlns: "http://www.w3.org/2000/svg",
              children: [
                /* @__PURE__ */ jsx("path", { d: "M0 0h24v24H0z", fill: "none" }),
                /* @__PURE__ */ jsx(
                  "path",
                  {
                    d: "M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z",
                    fill: "currentColor"
                  }
                )
              ]
            }
          ) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsx("section", { className: "centered-section", "aria-label": "Introduction Video", children: /* @__PURE__ */ jsx(VideoPlayer, {}) }),
      /* @__PURE__ */ jsxs("section", { id: "theTour", className: "theTour centered-section", "aria-labelledby": "tour-heading", children: [
        /* @__PURE__ */ jsxs("div", { id: "tour-heading", className: "content", children: [
          /* @__PURE__ */ jsx("h2", { children: "THE TOUR" }),
          /* @__PURE__ */ jsx("p", { children: "Departing from the ‘Creux’ Harbour, the original fishing port on Sark we will take a leisurely two and a half hour trip around the Island, exploring the bays, coves and secret caves." }),
          /* @__PURE__ */ jsx("p", { children: " In season you can see our sea birds such as puffins, guillemots, razor-bills, cormorants and many others. There is also the chance of seeing some of Sark’s other sea life such as dolphins and seals, even basking sharks and sunfish." }),
          /* @__PURE__ */ jsx("p", { children: "We usually run two trips daily, at 11am and 2pm weather dependent. " })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "content", children: [
          /* @__PURE__ */ jsx("h2", { children: "THE BOAT" }),
          /* @__PURE__ */ jsx("p", { children: "Rebuilt in 2024, the Dorado is a purpose built Treeve Marine 25’ , one of the most successful British built boats. She was commissioned in 1980 for Dominic Wakey who ran tours around the island until the mid 90’s when he refitted the Dorado as a fishing boat." }),
          /* @__PURE__ */ jsx("p", { children: "After the loss of Non Pareil, our much loved wooden Sark built boat, we have restored the Dorado as a tour boat once again! She is a 25ft GRP hull and comfortably carries up to 12 passengers. On board is a toilet and full safety equipment including life jackets and lifeboats for all passengers and crew." })
        ] })
      ] }),
      /* @__PURE__ */ jsx(Slideshow, { images }),
      /* @__PURE__ */ jsxs("section", { id: "charters", className: "charters centered-section", "aria-labelledby": "charters-heading", children: [
        /* @__PURE__ */ jsxs("div", { id: "charters-heading", className: "content", children: [
          /* @__PURE__ */ jsx("h2", { children: "CHARTERS" }),
          /* @__PURE__ */ jsx("h3", { children: "Did you know we do charters?" }),
          /* @__PURE__ */ jsx("p", { children: "If you are a larger group and/or would just like the boat to yourself we can arrange a charter tour! We can do specific tours such as; a tour to see the sea birds of L’Etac, an early morning / late evening cruise." }),
          /* @__PURE__ */ jsx("p", { children: " Or perhaps you fancy a trip around to one of Sark’s secluded bays. We can provide SUP’s, snorkeling gear and even a packed lunch." }),
          /* @__PURE__ */ jsx("p", { children: "For more information and ideas for a charter to suit you, please click below." }),
          /* @__PURE__ */ jsx(NavLink, { to: "/charters", children: /* @__PURE__ */ jsx("button", { className: "btn", children: "Discover more and book yours" }) })
        ] }),
        /* @__PURE__ */ jsx("img", { src: charters, alt: "Charter trip inside a sea cave", loading: "lazy" })
      ] }),
      /* @__PURE__ */ jsxs("section", { id: "sarkIsland", className: "sarkIsland centered-section", "aria-labelledby": "island-heading", children: [
        /* @__PURE__ */ jsx("h2", { id: "island-heading", children: "SARK ISLAND" }),
        /* @__PURE__ */ jsxs("div", { className: "grid1 textGrid", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Sark is the crown jewel of the Channel Islands, nestled in between Guernsey and Jersey." }),
            /* @__PURE__ */ jsx("p", { children: "Sark offers a truly unique holiday experience for those wanting to escape the bright lights and noise of the city. A visit to our car-free island is like a step back in time and visitors are sure to be blown away by the stunning scenery, bays, coastal paths and cliff top views." }),
            /* @__PURE__ */ jsx("p", { children: "Sark is also the world's first 'Dark Sky' Island, offering spectacular star gazing throughout the year and the Goliout headland is a world recognized Ramsar site" }),
            /* @__PURE__ */ jsx("p", { children: "The Island's 22 mile coastline is a treasure trove of small coves, creeks, caves, inlets and bays, all teaming with sea life both above and below the water. " })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Did you know?:" }),
            /* @__PURE__ */ jsx("p", { children: "Sark has a tidal range of around 10m. which means no trip around the island will be the same, on some tides we can access caves, on others we can get within touching distance of some of the off-shore rocks." }),
            /* @__PURE__ */ jsx("p", { children: "On a ‘Spring low’ tide we can show you some of the many scrambling routes on Sark." })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid1", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { children: "GETTING HERE" }),
            /* @__PURE__ */ jsx("p", { children: "Just a 50 minute boat ride from Guernsey, Sark feels an entire world away. Several ferries run daily during summer with daily trips during off season." }),
            /* @__PURE__ */ jsx("p", { children: "Visit the Isle of Sark shipping website for more info and online booking" }),
            /* @__PURE__ */ jsx("a", { href: "https://www.sarkshipping.gg", target: "_blank", rel: "noopener noreferrer", children: /* @__PURE__ */ jsx("p", { children: "www.sarkshipping.gg (opens in new tab)" }) })
          ] }),
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("img", { src: sarkShipping, alt: "Ferry from Guernsey to Sark", loading: "lazy" }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid1", children: [
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("img", { src: suesbnb, alt: "Sue's BnB", loading: "lazy" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { children: "SUE'S BNB" }),
            /* @__PURE__ */ jsx("p", { children: "We also offer 4* accommodation on the island at Sue’s BnB," }),
            /* @__PURE__ */ jsx("p", { children: "‘Sue's B&B is the perfect place for settling into Sark life. Relax in the award winning garden on sunny days or use it as a base to explore the sandy beaches and hidden caves and at night explore the galaxy with our telescope’" }),
            /* @__PURE__ */ jsx("p", { children: "Book by calling +44 1481 832107 or emailing suebnbsark@gmail.com" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(Reviews, {}),
      /* @__PURE__ */ jsxs("section", { id: "reservations", className: "reservations centered-section", "aria-labelledby": "res-heading", children: [
        /* @__PURE__ */ jsx("h2", { id: "res-heading", children: "RESERVATIONS" }),
        /* @__PURE__ */ jsx("p", { children: "Please note that we do not charge a deposit online - so if your plans change please let us know asap so we can rearrange your seat. Payment is on the day, at the end of the trip - either in cash or by card." })
      ] }),
      /* @__PURE__ */ jsx(Bookings, {})
    ] })
  ] });
}
const charterDerrible = "/assets/Charter_Tour_Derrible-BIV8GB9N.webp";
const guillemots = "/assets/Guillemots-CGm_oPBc.webp";
function Charters() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("title", { children: "Sark Boat Trips | Charters" }),
    /* @__PURE__ */ jsx("meta", { name: "description", content: "Book a private charter tour with Sark Boat Trips! Explore Sarks facinating coastline, visit secluded bays and swim or SUP from the boat!" }),
    /* @__PURE__ */ jsx("meta", { name: "keywords", content: "Private Charter Tours, Beach explorers, Stand up paddle Board rental, Swimming trips" }),
    /* @__PURE__ */ jsxs("main", { id: "main-content", children: [
      /* @__PURE__ */ jsxs("section", { id: "charters", className: "charterTours", "aria-labelledby": "charters-title", children: [
        /* @__PURE__ */ jsx("h2", { id: "charters-title", children: "CHARTER TOURS" }),
        /* @__PURE__ */ jsxs("article", { className: "grid1", "aria-labelledby": "beach-explorer-title", children: [
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(
            "img",
            {
              width: "600px",
              height: "auto",
              src: charterDerrible,
              alt: "Dorado boat anchored at Derrible Bay beach"
            }
          ) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { id: "beach-explorer-title", children: "Beach Explorer" }),
            /* @__PURE__ */ jsx("p", { children: "Sark is known for its secluded, difficult to access, beaches. So why not hire us to take to you there in comfort and perhaps visit a bay inaccessible by land." })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "grid1", "aria-labelledby": "birdwatching-title", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { id: "birdwatching-title", children: "Birdwatching" }),
            /* @__PURE__ */ jsx("p", { children: "In season we have resident colonies of Guillemots, Razorbills, Puffins and Fulmar. Why not hire us for a trip out to their off-shore colonies and get up close and personal with these elusive seabirds." })
          ] }),
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(
            "img",
            {
              width: "600px",
              height: "auto",
              src: guillemots,
              alt: "Group of Guillemots nesting on a coastal cliff"
            }
          ) })
        ] }),
        /* @__PURE__ */ jsxs("section", { "aria-labelledby": "more-ideas-title", children: [
          /* @__PURE__ */ jsx("h3", { id: "more-ideas-title", children: "More ideas" }),
          /* @__PURE__ */ jsxs("div", { className: "grid1", children: [
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Evening cruise/early morning tour." }),
              " If you’re looking for an unforgettable end to your day in Sark why not hire us for the evening and take a cruise around the island in the evening light. Maybe with a glass of champagne to toast the day!"
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Safety boat." }),
              " Whether you’re doing a long distance swim / exploring the island by kayak, safety is paramount. We can stay close and escort you around the island. We also have a wealth of experience and knowledge of the tides around the island and can help you plan a safe route."
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "charter-notice", children: [
            /* @__PURE__ */ jsx("h4", { children: "If you have any questions or ideas, please contact us and discuss options. We’re sure we can build you an adventure to remember!" }),
            /* @__PURE__ */ jsx("h4", { children: "Or use the form below to book your charter trip! Please note we require a (refundable) deposit of 20% to reserve a charter tour!" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(Bookings, {})
    ] })
  ] });
}
function Dashboard() {
  const [loggedin, setLoggedIn] = useState(false);
  const [selectedDate, setSelectedDate] = useState();
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [dateNotes, setDateNotes] = useState([]);
  const [showResponse, setResponse] = useState(null);
  const [seasonStartDate, setSeasonStartDate] = useState("");
  const [seasonEndDate, setSeasonEndDate] = useState("");
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const res = await getSeasonDates();
        if (res) {
          const start = new Date(res.seasonStartDate).toISOString().split("T")[0];
          const end = new Date(res.seasonEndDate).toISOString().split("T")[0];
          setSeasonStartDate(start);
          setSeasonEndDate(end);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchDates();
  }, []);
  const setSeasonDates = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${URL$1}/admin/setSeasonDates`, { seasonStartDate, seasonEndDate });
      setResponse(res.data.data);
    } catch (error) {
      console.error(error);
      setResponse("Error Saving Dates");
    }
  };
  const checkLogin = async (e) => {
    e.preventDefault();
    let user = {
      userName: e.target.username.value,
      password: e.target.password.value
    };
    let response = await axios.post(`${URL$1}/admin/login`, user);
    setLoggedIn(response.data.data);
  };
  const Logout = async () => {
    setLoggedIn(false);
  };
  const getBookingsByDate = async () => {
    try {
      const res = await axios.get(`${URL$1}/bookings/${selectedDate}`);
      setBookings(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };
  const getBookingsByLastName = async (e) => {
    e.preventDefault();
    setSearch(e.target.lastName.value);
    try {
      const res = await axios.get(`${URL$1}/bookings/search/${search}`);
      setBookings(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };
  const deleteBooking = async (e) => {
    e.preventDefault();
    let booking = {
      _id: e.target._id.value
    };
    try {
      const res = await axios.post(`${URL$1}/bookings/delete`, booking);
      setResponse(res.data.data);
    } catch (error) {
      console.error(error);
    }
    e.target.reset();
  };
  const updateAvailability = async (e) => {
    e.preventDefault();
    let update = {
      date: e.target.date.value,
      timeslot: e.target.timeslot.value,
      capacity: e.target.capacity.value
    };
    try {
      const res = await axios.post(`${URL$1}/bookings/updateavailability`, update);
      setResponse(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };
  const addOrUpdateNote = async (e) => {
    e.preventDefault();
    if (!selectedDate) {
      setResponse("Please select a date on the calendar first");
    }
    let noteData = {
      date: selectedDate,
      content: noteContent
    };
    try {
      const res = await axios.post(`${URL$1}/notes`, noteData);
      setResponse(res.data.message || "Note saved successfully!");
      setNoteContent("");
      fetchNotesForSelectedDate();
    } catch (error) {
      setResponse(error.response?.data?.message || "Failed to save note");
    }
  };
  const fetchNotesForSelectedDate = async () => {
    if (!selectedDate) return;
    try {
      const res = await axios.get(`${URL$1}/notes/${selectedDate}`);
      setDateNotes(res.data.data);
    } catch (error) {
      console.error("Error fetching notes", error);
      setDateNotes([]);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("title", { children: "Sark Boat Trips | Dashboard" }),
    /* @__PURE__ */ jsxs("div", { className: "dashboard", children: [
      /* @__PURE__ */ jsxs("div", { className: "centered-section padded", children: [
        loggedin ? /* @__PURE__ */ jsx("button", { className: "logoutButton", onClick: Logout, children: "Log Out" }) : null,
        !loggedin ? /* @__PURE__ */ jsxs("form", { onSubmit: checkLogin, children: [
          /* @__PURE__ */ jsx("input", { type: "text", id: "username", name: "username", placeholder: "username", required: true }),
          /* @__PURE__ */ jsx("input", { type: "password", id: "password", name: "password", placeholder: "password", required: true }),
          /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx("button", { className: "btn", type: "submit", children: "Log in" }),
            /* @__PURE__ */ jsx("button", { className: "btn", onClick: Logout, type: "reset", children: "Log Out" })
          ] })
        ] }) : null,
        loggedin ? /* @__PURE__ */ jsx("p", { className: "logged", children: "logged in" }) : /* @__PURE__ */ jsx("p", { className: "notLogged", children: "Please log in" })
      ] }),
      loggedin ? /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("div", { className: "bookingsDisplay", children: [
          /* @__PURE__ */ jsxs("div", { className: "left-grid", children: [
            /* @__PURE__ */ jsx("div", { className: "minorform", children: /* @__PURE__ */ jsxs("form", { id: "setSeasonDates", onSubmit: setSeasonDates, children: [
              /* @__PURE__ */ jsxs("lable", { children: [
                "Start Date",
                /* @__PURE__ */ jsx("input", { type: "date", value: seasonStartDate, onChange: (e) => setSeasonStartDate(e.target.value), required: true })
              ] }),
              /* @__PURE__ */ jsxs("lable", { children: [
                "End Date",
                /* @__PURE__ */ jsx("input", { type: "date", value: seasonEndDate, onChange: (e) => setSeasonEndDate(e.target.value), required: true })
              ] }),
              /* @__PURE__ */ jsx("button", { type: "submit", className: "btn", children: "Set Season Dates" })
            ] }) }),
            /* @__PURE__ */ jsx(
              MyCalendar,
              {
                setSelectedDate,
                seasonStartDate,
                seasonEndDate
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "minorform", children: [
              /* @__PURE__ */ jsx("button", { className: "btn", onClick: () => {
                getBookingsByDate();
                fetchNotesForSelectedDate();
              }, children: "Get bookings by date" }),
              /* @__PURE__ */ jsx("form", { id: "bookingsearch", onSubmit: getBookingsByLastName, children: /* @__PURE__ */ jsx("input", { type: "text", id: "lastName", name: "lastName", placeholder: "get bookings by last name" }) })
            ] }),
            /* @__PURE__ */ jsxs("form", { id: "deleteBooking", onSubmit: deleteBooking, className: "minorform", children: [
              /* @__PURE__ */ jsx("input", { type: "text", id: "_id", name: "_id", placeholder: "Booking ID" }),
              /* @__PURE__ */ jsx("button", { className: "btn", style: { backgroundColor: "lightcoral" }, children: "Delete this booking" })
            ] }),
            /* @__PURE__ */ jsxs("form", { id: "updateAvailability", className: "minorform", onSubmit: updateAvailability, children: [
              /* @__PURE__ */ jsx("input", { type: "text", id: "date", name: "date", placeholder: "Date dd-mm-yyyy" }),
              /* @__PURE__ */ jsxs("select", { id: "timeslot", name: "timeslot", required: true, children: [
                /* @__PURE__ */ jsx("option", { value: "11am", children: "11am" }),
                /* @__PURE__ */ jsx("option", { value: "2pm", children: "2pm" })
              ] }),
              /* @__PURE__ */ jsx("input", { type: "number", id: "capacity", name: "capacity", placeholder: "capacity", required: true }),
              /* @__PURE__ */ jsx("button", { className: "btn", type: "submit", children: "Update Availability" })
            ] }),
            /* @__PURE__ */ jsxs("form", { id: "addNote", className: "minorform", onSubmit: addOrUpdateNote, children: [
              /* @__PURE__ */ jsx(
                "textarea",
                {
                  id: "notecontent",
                  name: "notecontent",
                  placeholder: "Enter note for the selected date...",
                  value: noteContent,
                  onChange: (e) => setNoteContent(e.target.value),
                  rows: "2",
                  cols: "50",
                  required: true
                }
              ),
              /* @__PURE__ */ jsx("button", { className: "btn", type: "submit", children: "Save Note" })
            ] }),
            showResponse != null ? /* @__PURE__ */ jsx("div", { className: "responseBackdrop", children: /* @__PURE__ */ jsxs("div", { className: "responseDisplay", children: [
              /* @__PURE__ */ jsx("h3", { children: showResponse }),
              /* @__PURE__ */ jsx("button", { className: "btn", onClick: () => setResponse(null), children: "Confirm" })
            ] }) }) : null
          ] }),
          /* @__PURE__ */ jsx("div", { className: "right-grid", children: /* @__PURE__ */ jsx(BookingForm, { selectedDate }) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "notes-section minorform", children: /* @__PURE__ */ jsxs("div", { className: "current-notes", children: [
          /* @__PURE__ */ jsx("h4", { children: `Notes for ${selectedDate}` }),
          dateNotes.length > 0 ? /* @__PURE__ */ jsx("ul", { children: dateNotes.map((note) => /* @__PURE__ */ jsx("li", { children: note.content }, note._id)) }) : /* @__PURE__ */ jsx("p", { children: "No notes for this date yet." })
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "bookingsTable", children: bookings.length != 0 ? /* @__PURE__ */ jsxs("table", { children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "_id" }),
            /* @__PURE__ */ jsx("th", { children: "Date" }),
            /* @__PURE__ */ jsx("th", { children: "Timeslot" }),
            /* @__PURE__ */ jsx("th", { children: "First Name" }),
            /* @__PURE__ */ jsx("th", { children: "Last Name" }),
            /* @__PURE__ */ jsx("th", { children: "Email" }),
            /* @__PURE__ */ jsx("th", { children: "Phone" }),
            /* @__PURE__ */ jsx("th", { children: "Adults" }),
            /* @__PURE__ */ jsx("th", { children: "Children" }),
            /* @__PURE__ */ jsx("th", { children: "Accommodation" }),
            /* @__PURE__ */ jsx("th", { children: "Message" }),
            /* @__PURE__ */ jsx("th", { children: "Charter" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: bookings.map((ele, i) => {
            return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { children: ele._id }),
              /* @__PURE__ */ jsx("td", { children: ele.date }),
              /* @__PURE__ */ jsx("td", { children: ele.timeslot }),
              /* @__PURE__ */ jsx("td", { children: ele.firstName }),
              /* @__PURE__ */ jsx("td", { children: ele.lastName }),
              /* @__PURE__ */ jsx("td", { children: ele.email }),
              /* @__PURE__ */ jsx("td", { children: ele.phone }),
              /* @__PURE__ */ jsx("td", { children: ele.adults }),
              /* @__PURE__ */ jsx("td", { children: ele.children }),
              /* @__PURE__ */ jsx("td", { children: ele.accommodation }),
              /* @__PURE__ */ jsx("td", { className: "message", children: ele.message }),
              /* @__PURE__ */ jsx("td", { children: ele.charter })
            ] }, i) });
          }) })
        ] }) : null })
      ] }) : null
    ] })
  ] });
}
function Success() {
  const [response, setResponseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const verifyPayment = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    if (!sessionId) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${URL$1}/charters/verify-payment?session_id=${sessionId}`);
      if (res.data.ok) {
        setResponseData(res.data);
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    verifyPayment();
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("title", { children: "Sark Boat Trips | Payment Successful" }),
    /* @__PURE__ */ jsx("main", { id: "main-content", className: "stripe-landing", children: /* @__PURE__ */ jsx("div", { role: "status", "aria-live": "polite", children: loading ? /* @__PURE__ */ jsx("h1", { children: "Verifying your booking..." }) : response ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("h1", { children: "Success!" }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("strong", { children: response.name }),
        ", thank you so much for booking your charter tour with us!"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        "Your deposit has been confirmed and your charter is reserved for ",
        /* @__PURE__ */ jsx("strong", { children: response.date }),
        "."
      ] }),
      /* @__PURE__ */ jsxs("section", { "aria-label": "Next steps", style: { marginTop: "20px" }, children: [
        /* @__PURE__ */ jsx("p", { children: "If you haven't already, please contact us to arrange your trip and let us know what we can do for you!" }),
        /* @__PURE__ */ jsxs("address", { style: { fontStyle: "normal" }, children: [
          /* @__PURE__ */ jsxs("p", { children: [
            "Email: ",
            /* @__PURE__ */ jsx("a", { href: "mailto:sarkboattrips@gmail.com", children: "sarkboattrips@gmail.com" })
          ] }),
          /* @__PURE__ */ jsxs("p", { children: [
            "WhatsApp: ",
            /* @__PURE__ */ jsx("a", { href: "https://wa.me/447911764246", children: "+44 7911 764 246" })
          ] })
        ] })
      ] })
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("h1", { children: "Something went wrong" }),
      /* @__PURE__ */ jsx("p", { children: "We couldn't verify your session. Please contact us if you believe this is an error." })
    ] }) }) })
  ] });
}
function Canceled() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("title", { children: "Sark Boat Trips | Payment Canceled" }),
    /* @__PURE__ */ jsxs("main", { id: "main-content", className: "stripe-landing", children: [
      /* @__PURE__ */ jsxs("div", { role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ jsx("h2", { children: "Payment Not Processed" }),
        /* @__PURE__ */ jsx("p", { children: "Uh oh, it looks like something went wrong with your payment or the session was canceled. Don't worry—your card has not been charged." })
      ] }),
      /* @__PURE__ */ jsxs("section", { "aria-label": "Support options", style: { marginTop: "20px" }, children: [
        /* @__PURE__ */ jsx("p", { children: "Please try again, or get in touch if you need some help!" }),
        /* @__PURE__ */ jsxs("address", { style: { fontStyle: "normal", margin: "20px 0" }, children: [
          /* @__PURE__ */ jsxs("p", { children: [
            "Email: ",
            /* @__PURE__ */ jsx("a", { href: "mailto:sarkboattrips@gmail.com", children: "sarkboattrips@gmail.com" })
          ] }),
          /* @__PURE__ */ jsxs("p", { children: [
            "WhatsApp: ",
            /* @__PURE__ */ jsx("a", { href: "https://wa.me/447911764246", children: "+44 7911 764 246" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(Link, { className: "btn", to: "/charters", "aria-label": "Return to the charters page to try again", children: "Back to charters" })
    ] })
  ] });
}
function NotFound() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("title", { children: "Sark Boat Trips | 404 Page Not Found" }),
    /* @__PURE__ */ jsxs("main", { id: "main-content", style: { textAlign: "center", padding: "100px 20px", minHeight: "80vh" }, children: [
      /* @__PURE__ */ jsx("div", { role: "status", children: /* @__PURE__ */ jsx("h1", { style: { fontSize: "3rem" }, children: "404 - Adrift!" }) }),
      /* @__PURE__ */ jsx("p", { style: { fontSize: "1.2rem", marginBottom: "2rem" }, children: "It looks like you've gone off course. The page you are looking for has been washed away or doesn't exist." }),
      /* @__PURE__ */ jsx(Link, { className: "btn", to: "/", "aria-label": "Return to the Sark Boat Trips home page", children: "Back to safe harbour (Home)" })
    ] })
  ] });
}
function PrivacyPolicy() {
  return /* @__PURE__ */ jsxs("article", { className: "popUpDisplay", "aria-labelledby": "pp-title", children: [
    /* @__PURE__ */ jsx("h2", { id: "pp-title", children: "Privacy Policy for Sark Boat Trips" }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "1. Introduction" }) }),
      /* @__PURE__ */ jsx("p", { children: "Welcome to Sark Boat Trips. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, and protect your data when you use our website (sarkboattrips.com) and our services." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "2. Data Controller" }) }),
      /* @__PURE__ */ jsx("p", { children: "Sark Boat Trips is the data controller responsible for your personal data. You can contact us at:" }),
      /* @__PURE__ */ jsx("address", { style: { fontStyle: "normal" }, children: /* @__PURE__ */ jsxs("ul", { children: [
        /* @__PURE__ */ jsx("li", { children: "Sark Boat Trips, Dixcart Ln, Sark, GY101SA, Guernsey" }),
        /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { href: "tel:+447911764246", children: "+44 7911 764 246" }) }),
        /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { href: "mailto:sarkboattrips@gmail.com", children: "sarkboattrips@gmail.com" }) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "3. Information We Collect" }) }),
      /* @__PURE__ */ jsxs("ul", { children: [
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Contact Information:" }),
          " Name, email address, phone number, and any other information you provide when contacting us or making a booking."
        ] }),
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Booking Information:" }),
          " Details of your bookings, including dates, times, and requirements."
        ] }),
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Payment Data:" }),
          " For charter bookings, payments are processed securely by Stripe. We do not store your credit card information."
        ] }),
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Website Usage Data:" }),
          " IP addresses, browser type, and pages visited."
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "4. How We Use Your Information" }) }),
      /* @__PURE__ */ jsxs("ul", { children: [
        /* @__PURE__ */ jsx("li", { children: "To process and manage your bookings." }),
        /* @__PURE__ */ jsx("li", { children: "To respond to inquiries and provide customer support." }),
        /* @__PURE__ */ jsx("li", { children: "To comply with Bailiwick of Guernsey legal obligations." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "5. Data Sharing & Transfers" }) }),
      /* @__PURE__ */ jsx("p", { children: "We share information with service providers (like Stripe for payments or hosting providers) only as necessary. Data may be processed outside the Bailiwick of Guernsey by these providers, subject to standard contractual protections." }),
      /* @__PURE__ */ jsx("p", { children: "We will never sell or rent your personal information." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "6. Data Retention" }) }),
      /* @__PURE__ */ jsx("p", { children: "We will retain your personal information for as long as necessary to fulfill the purposes for which it was collected, including legal, accounting, or reporting requirements." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "7. Your Rights" }) }),
      /* @__PURE__ */ jsx("p", { children: "Under the Data Protection (Bailiwick of Guernsey) Law, 2017, you have the right to access, rectify, or erase your data, and to object to or restrict its processing." }),
      /* @__PURE__ */ jsx("p", { children: "You also have the **Right to Complain** to the Office of the Data Protection Authority (ODPA) in Guernsey if you are unhappy with how we handle your data." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "8. Cookies" }) }),
      /* @__PURE__ */ jsx("p", { children: "Our website may use cookies to enhance your experience. You can manage these via your browser settings." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "9. Contact Us" }) }),
      /* @__PURE__ */ jsxs("p", { children: [
        "For any privacy-related questions, please email us at ",
        /* @__PURE__ */ jsx("a", { href: "mailto:sarkboattrips@gmail.com", children: "sarkboattrips@gmail.com" }),
        "."
      ] })
    ] })
  ] });
}
function Terms() {
  return /* @__PURE__ */ jsxs("article", { className: "popUpDisplay", "aria-labelledby": "terms-title", children: [
    /* @__PURE__ */ jsx("h2", { id: "terms-title", children: "Terms and Conditions - Sark Boat Trips" }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "1. Payment" }) }),
      /* @__PURE__ */ jsx("p", { children: "For standard tours, payment is due upon completion of the trip. We accept cash or card (GBP). For private charters, a 20% deposit is required at the time of booking, with the balance payable on the day of the trip." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "2. Cancellation by You" }) }),
      /* @__PURE__ */ jsx("p", { children: "Please provide at least 24 hours' notice for cancellations. For private charters, deposits are refundable if cancelled with more than 48 hours' notice, or if we can re-book the slot." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "3. Cancellation by Sark Boat Trips" }) }),
      /* @__PURE__ */ jsx("p", { children: "We reserve the right to cancel or reschedule due to adverse weather, mechanical failure, or if minimum passenger numbers (4) are not met for scheduled tours. In these cases, a full refund of any deposits paid will be issued. We are not liable for any consequential losses (e.g., travel or accommodation costs)." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "4. Safety & Conduct" }) }),
      /* @__PURE__ */ jsx("p", { children: "Passengers must follow all instructions given by the skipper. We reserve the right to refuse passage to anyone deemed a safety risk, including those under the influence of excessive alcohol. Children must be supervised at all times. Passengers must remain seated while the vessel is underway." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "5. Personal Belongings" }) }),
      /* @__PURE__ */ jsx("p", { children: "Sark Boat Trips is not liable for loss or damage to personal items (cameras, phones, etc.) while on board. We recommend keeping electronics in waterproof bags." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "6. Liability" }) }),
      /* @__PURE__ */ jsx("p", { children: "Sark Boat Trips maintains full public liability insurance as required by Guernsey law. Our liability begins once you are on board the vessel and ends upon disembarkation." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "7. Medical Conditions" }) }),
      /* @__PURE__ */ jsx("p", { children: "Please inform the skipper of any medical conditions, limited mobility, or severe sea sickness before departure so we can ensure your safety and comfort." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "8. Governing Law" }) }),
      /* @__PURE__ */ jsx("p", { children: "These terms are governed by and construed in accordance with the laws of the Bailiwick of Guernsey." })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "9. Wildlife" }) }),
      /* @__PURE__ */ jsx("p", { children: "While we know the best spots for puffins, seals, and dolphins, sightings are subject to nature and cannot be guaranteed." })
    ] })
  ] });
}
const instaLogo = "data:image/png;base64,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";
function Footer() {
  const [showPrivacyP, setshowPrivacyP] = useState(false);
  const [showTerms, setshowTerms] = useState(false);
  return /* @__PURE__ */ jsxs("footer", { children: [
    showPrivacyP && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          onClick: () => setshowPrivacyP(false),
          className: "popUpBackground",
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsx(PrivacyPolicy, { close: () => setshowPrivacyP(false) })
    ] }),
    showTerms && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          onClick: () => setshowTerms(false),
          className: "popUpBackground",
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsx(Terms, { close: () => setshowTerms(false) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "footer-container", children: [
      /* @__PURE__ */ jsxs("address", { className: "footer-section", children: [
        /* @__PURE__ */ jsx("a", { href: "https://maps.google.com/?q=Sark+Boat+Trips+Dixcart+Ln+Sark", target: "_blank", rel: "noopener noreferrer", children: "Sark Boat Trips, Dixcart Ln, Sark, GY10, Guernsey" }),
        /* @__PURE__ */ jsx("a", { href: "tel:+447911764246", "aria-label": "Call us at +44 7911 764 246", children: "+44 7911 764 246" }),
        /* @__PURE__ */ jsx("a", { href: "mailto:sarkboattrips@gmail.com", children: "sarkboattrips@gmail.com" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "footer-section", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "footer-btn-link",
            onClick: () => setshowPrivacyP(true),
            "aria-haspopup": "dialog",
            children: "Privacy Policy"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "footer-btn-link",
            onClick: () => setshowTerms(true),
            "aria-haspopup": "dialog",
            children: "Terms and Conditions"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("nav", { className: "footer-links", "aria-label": "Social Media Links", children: [
        /* @__PURE__ */ jsx("a", { href: "https://www.facebook.com/sarkboattrips", target: "_blank", rel: "noopener noreferrer", "aria-label": "Visit our Facebook page", children: /* @__PURE__ */ jsx("img", { width: "32px", src: faceLogo, alt: "Facebook" }) }),
        /* @__PURE__ */ jsx("a", { href: "https://www.instagram.com/sark_boat_trips/", target: "_blank", rel: "noopener noreferrer", "aria-label": "Visit our Instagram profile", children: /* @__PURE__ */ jsx("img", { width: "32px", src: instaLogo, alt: "Instagram" }) }),
        /* @__PURE__ */ jsx("a", { href: "https://www.tripadvisor.com/Attraction_Review-g186231-d6673939-Reviews-Sark_Boat_Trips-Sark_Channel_Islands.html", target: "_blank", rel: "noopener noreferrer", "aria-label": "Check our reviews on Tripadvisor", children: /* @__PURE__ */ jsx("img", { width: "32px", src: tripLogo, alt: "Tripadvisor" }) }),
        /* @__PURE__ */ jsx("a", { href: "https://g.co/kgs/RsJniax", target: "_blank", rel: "noopener noreferrer", "aria-label": "Find us on Google Maps", children: /* @__PURE__ */ jsx("img", { width: "32px", src: googleLogo, alt: "Google" }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "footer-bottom", children: /* @__PURE__ */ jsxs("p", { children: [
      "© ",
      (/* @__PURE__ */ new Date()).getFullYear(),
      " Sark Boat Trips. All rights reserved."
    ] }) })
  ] });
}
const Wrapper = ({ children }) => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  return children;
};
function App() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Wrapper, { children: [
      /* @__PURE__ */ jsx(Navbar, {}),
      /* @__PURE__ */ jsx(MobileNav, {}),
      /* @__PURE__ */ jsxs(Routes, { children: [
        /* @__PURE__ */ jsx(Route, { path: "/", element: /* @__PURE__ */ jsx(Home, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "/bookings", element: /* @__PURE__ */ jsx(Bookings, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "/charters", element: /* @__PURE__ */ jsx(Charters, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "/dashboard", element: /* @__PURE__ */ jsx(Dashboard, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "/success", element: /* @__PURE__ */ jsx(Success, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "/canceled", element: /* @__PURE__ */ jsx(Canceled, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "*", element: /* @__PURE__ */ jsx(NotFound, {}) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Footer, {})
  ] });
}
function render() {
  const html = ReactDOMServer.renderToString(
    /* @__PURE__ */ jsx(React3__default.StrictMode, { children: /* @__PURE__ */ jsx(StaticRouter, { location: "/", children: /* @__PURE__ */ jsx(App, {}) }) })
  );
  return html;
}
export {
  render
};
