import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import BulletEditor from "@/components/practice/BulletEditor";

const areas = () => screen.getAllByRole("textbox") as HTMLTextAreaElement[];
const caretAtEnd = (el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length);

describe("BulletEditor — bullets as bullets while typing", () => {
  it("opens with one bullet per saved line, nested ones read the board's way", () => {
    render(<BulletEditor defaultValue={"Bag work\n  3 rounds\n- Jump rope"} onSave={() => {}} />);
    const a = areas();
    expect(a.map((x) => x.value)).toEqual(["Bag work", "3 rounds", "Jump rope"]);
    expect(a[0].getAttribute("aria-label")).toBe("Bullet 1");
    expect(a[1].getAttribute("aria-label")).toBe("Sub-bullet 2");
    expect(a[2].getAttribute("aria-label")).toBe("Sub-bullet 3");
  });

  it("Enter makes the next bullet (keeping the nesting), Tab nests, Shift+Tab un-nests, Backspace on an empty bullet removes it", () => {
    render(<BulletEditor defaultValue="Bag work" onSave={() => {}} />);
    let a = areas();
    caretAtEnd(a[0]);
    fireEvent.keyDown(a[0], { key: "Enter" });
    a = areas();
    expect(a).toHaveLength(2);
    expect(document.activeElement).toBe(a[1]);

    fireEvent.change(a[1], { target: { value: "3 rounds" } });
    fireEvent.keyDown(a[1], { key: "Tab" });
    expect(areas()[1].getAttribute("aria-label")).toBe("Sub-bullet 2");

    // Enter on a nested bullet starts another nested bullet.
    caretAtEnd(areas()[1]);
    fireEvent.keyDown(areas()[1], { key: "Enter" });
    expect(areas()).toHaveLength(3);
    expect(areas()[2].getAttribute("aria-label")).toBe("Sub-bullet 3");

    fireEvent.keyDown(areas()[2], { key: "Tab", shiftKey: true });
    expect(areas()[2].getAttribute("aria-label")).toBe("Bullet 3");

    // Backspace at the start of an empty top-level bullet merges it away.
    areas()[2].setSelectionRange(0, 0);
    fireEvent.keyDown(areas()[2], { key: "Backspace" });
    expect(areas()).toHaveLength(2);
    expect(document.activeElement).toBe(areas()[1]);
  });

  it("saves once, when focus leaves the editor, as the text the board reads", () => {
    const onSave = vi.fn();
    render(
      <div>
        <BulletEditor defaultValue="Bag work" onSave={onSave} />
        <button type="button">elsewhere</button>
      </div>
    );
    const a = areas();
    caretAtEnd(a[0]);
    fireEvent.keyDown(a[0], { key: "Enter" });
    fireEvent.change(areas()[1], { target: { value: "3 rounds" } });
    fireEvent.keyDown(areas()[1], { key: "Tab" });

    // Moving between bullets is not a save.
    act(() => areas()[0].focus());
    expect(onSave).not.toHaveBeenCalled();

    // Leaving the editor is.
    const outside = screen.getByText("elsewhere");
    act(() => {
      fireEvent.blur(areas()[0], { relatedTarget: outside });
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("Bag work\n- 3 rounds");
  });

  it("does not save when nothing changed, and saves null when everything was cleared", () => {
    const onSave = vi.fn();
    render(<BulletEditor defaultValue="Bag work" onSave={onSave} />);
    act(() => { fireEvent.blur(areas()[0], { relatedTarget: null }); });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(areas()[0], { target: { value: "" } });
    act(() => { fireEvent.blur(areas()[0], { relatedTarget: null }); });
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it("pasting several lines makes several bullets", () => {
    render(<BulletEditor defaultValue="" onSave={() => {}} />);
    const el = areas()[0];
    el.setSelectionRange(0, 0);
    fireEvent.paste(el, { clipboardData: { getData: () => "Warm up\n- Jump rope\n- Shadow box\nSparring" } });
    const a = areas();
    expect(a.map((x) => x.value)).toEqual(["Warm up", "Jump rope", "Shadow box", "Sparring"]);
    expect(a.map((x) => x.getAttribute("aria-label")?.startsWith("Sub"))).toEqual([false, true, true, false]);
  });

  it("the nest button appears on the focused bullet and toggles it, for a finger", () => {
    render(<BulletEditor defaultValue="Bag work" onSave={() => {}} />);
    expect(screen.queryByLabelText(/Nest this bullet/)).toBeNull();
    act(() => areas()[0].focus());
    const btn = screen.getByLabelText("Nest this bullet");
    fireEvent.click(btn);
    expect(areas()[0].getAttribute("aria-label")).toBe("Sub-bullet 1");
    fireEvent.click(screen.getByLabelText("Un-nest this bullet"));
    expect(areas()[0].getAttribute("aria-label")).toBe("Bullet 1");
  });
});
