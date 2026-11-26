import { expect, it, vi } from "vite-plus/test";

import { render } from "../../../test/render";
import "~/index.css";
import PreviewImageContent from "./PreviewImageContent";

function png(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.toDataURL("image/png");
}

it("fits the image inside a pane with a fractional width", async () => {
  const host = document.createElement("div");
  host.style.cssText = "display:flex;flex-direction:column;width:500.5px;height:600px";
  await using _screen = await render(
    <PreviewImageContent src={png(1600, 900)} name="wide.png" mimeType="image/png" />,
    { container: host },
  );
  const image = host.querySelector("img")!;
  const padding = 32;

  await vi.waitFor(() => {
    const width = image.getBoundingClientRect().width + padding;
    expect(width).toBeGreaterThan(499.5);
    expect(width).toBeLessThanOrEqual(500.5);
  });
});

it("keeps a cached image out of view until it is fitted", async () => {
  const src = png(1600, 900);
  const host = document.createElement("div");
  host.style.cssText = "display:flex;flex-direction:column;width:500px;height:600px";
  const image = () => host.querySelector("img");
  await using screen = await render(
    <PreviewImageContent key="first" src={src} name="wide.png" mimeType="image/png" />,
    { container: host },
  );
  await vi.waitFor(() => expect(image()?.getBoundingClientRect().width).toBeGreaterThan(400));

  // A new key remounts the preview, as a new file revision does. The cached image has its natural
  // size on insertion, and the observer measures it before the load event can fit it.
  let insertedWidth: number | undefined;
  const mounts = new MutationObserver(() => {
    insertedWidth ??= image()?.getBoundingClientRect().width;
  });
  mounts.observe(host, { childList: true, subtree: true });
  await screen.rerender(
    <PreviewImageContent key="second" src={src} name="wide.png" mimeType="image/png" />,
  );
  mounts.disconnect();

  expect(insertedWidth).toBeLessThanOrEqual(500);
  await vi.waitFor(() => expect(image()?.getBoundingClientRect().width).toBeGreaterThan(400));
});

it("pinch zooms around the pointer, from Ctrl+wheel or Safari's gesture events", async () => {
  const host = document.createElement("div");
  host.style.cssText = "display:flex;flex-direction:column;width:400px;height:300px";
  await using _screen = await render(
    <PreviewImageContent src={png(1600, 900)} name="wide.png" mimeType="image/png" />,
    { container: host },
  );
  const image = host.querySelector("img")!;
  const pane = image.closest<HTMLElement>(".overflow-auto")!;
  await vi.waitFor(() => expect(image.getBoundingClientRect().width).toBeGreaterThan(300));
  const before = image.getBoundingClientRect();
  const at = {
    clientX: before.left + before.width * 0.7,
    clientY: before.top + before.height * 0.6,
  };
  const spot = () => {
    const rect = image.getBoundingClientRect();
    return [(at.clientX - rect.left) / rect.width, (at.clientY - rect.top) / rect.height];
  };

  const wheel = new WheelEvent("wheel", { ...at, deltaY: -40, ctrlKey: true, cancelable: true });
  pane.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(true);
  expect(image.getBoundingClientRect().width).toBeCloseTo(before.width * Math.exp(0.4), 0);
  expect(spot()[0]).toBeCloseTo(0.7, 2);
  expect(spot()[1]).toBeCloseTo(0.6, 2);

  const gesture = (type: string, scale: number) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { ...at, scale });
    pane.dispatchEvent(event);
    return event;
  };
  const zoomed = image.getBoundingClientRect().width;
  expect(gesture("gesturestart", 1).defaultPrevented).toBe(true);
  gesture("gesturechange", 1.5);
  gesture("gestureend", 1.5);
  expect(image.getBoundingClientRect().width).toBeCloseTo(zoomed * 1.5, 0);
  expect(spot()[0]).toBeCloseTo(0.7, 2);
  expect(spot()[1]).toBeCloseTo(0.6, 2);
});
