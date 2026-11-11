import adapterNode from "@sveltejs/adapter-node";
import adapterNetlify from "@sveltejs/adapter-netlify";

// Pi deploy (deploy:pi) stays on adapter-node, unchanged. Netlify build sets
// DEPLOY_TARGET=netlify so the same repo can ship to either host.
const adapter =
  process.env.DEPLOY_TARGET === "netlify"
    ? adapterNetlify()
    : adapterNode({ out: "build" });

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter,
    // Inline small critical component stylesheets (PageLayout, Mascot,
    // BrandMark, AppSuffix) directly into prerendered HTML so first paint
    // never waits on half a dozen tiny render-blocking CSS round-trips.
    inlineStyleThreshold: 12288,
  },
};

export default config;
