import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "./AppShell";

const html = renderToStaticMarkup(
  <AppShell context={<span>f(x) = x</span>} history={["x^2"]} onUseExpression={() => {}} onNewAnalysis={() => {}}>
    <p>contenido</p>
  </AppShell>,
);

describe("AppShell mobile navigation", () => {
  it("the menu button controls a drawer that exists in the DOM", () => {
    expect(html).toMatch(/<button[^>]*class="nexor-icon-button nexor-menu-button"[^>]*aria-expanded="false"[^>]*aria-controls="nexor-mobile-navigation"/);
    expect(html).toContain('id="nexor-mobile-navigation"');
  });

  it("the closed drawer is hidden, not removed, and has no backdrop", () => {
    expect(html).toMatch(/<div id="nexor-mobile-navigation" class="nexor-mobile-nav lg:hidden" hidden="">/);
    expect(html).not.toContain("nexor-mobile-backdrop");
  });

  it("the drawer is rendered outside <main>, so it never takes space in the page flow", () => {
    const drawer = html.indexOf('id="nexor-mobile-navigation"');
    const main = html.indexOf('<main id="nexor-workspace"');
    expect(drawer).toBeGreaterThan(-1);
    expect(main).toBeGreaterThan(drawer);
    expect(html.slice(main)).not.toContain("nexor-mobile-nav");
  });
});
