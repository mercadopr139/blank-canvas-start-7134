import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import BulletEditor from "@/components/practice/BulletEditor";

const areas = () => screen.getAllByRole("textbox") as HTMLTextAreaElement[];
const labels = () => areas().map((x) => x.getAttribute("aria-label")?.replace(/ \d+$/, ""));
const caretAtEnd = (el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length);

describe("BulletEditor — bullets as bullets while typing", () => {
  it("opens with one bullet per saved line, nesting read the board's way, three levels", () => {
    render(<BulletEditor defaultValue={"Bag work\n  3 rounds\n- Jump rope\n  - Southpaw"} onSave={() => {}} />);
    expect(areas().map((x) => x.value)).toEqual(["Bag work", "3 rounds", "Jump rope", "Southpaw"]);
    expect(labels()).toEqual(["Bullet", "Sub-bullet", "Sub-bullet", "Sub-sub-bullet"]);
  });

  it("Enter makes the next bullet (keeping the level), Tab nests, Shift+Tab un-nests, Backspace on an empty bullet removes it", () => {
    render(<BulletEditor defaultValue="Bag work" onSave={() => {}} />);
    caretAtEnd(areas()[0]);
    fireEvent.keyDown(areas()[0], { key: "Enter" });
    expect(areas()).toHaveLength(2);
    expect(document.activeElement).toBe(areas()[1]);

    fireEvent.change(areas()[1], { target: { value: "3 rounds" } });
    fireEvent.keyDown(areas()[1], { key: "Tab" });
    expect(labels()[1]).toBe("Sub-bullet");

    // Enter on a sub-bullet starts another sub-bullet.
    caretAtEnd(areas()[1]);
    fireEvent.keyDown(areas()[1], { key: "Enter" });
    expect(areas()).toHaveLength(3);
    expect(labels()[2]).toBe("Sub-bullet");

    fireEvent.keyDown(areas()[2], { key: "Tab", shiftKey: true });
    expect(labels()[2]).toBe("Bullet");

    // Backspace at the start of an empty top-level bullet merges it away.
    areas()[2].setSelectionRange(0, 0);
    fireEvent.keyDown(areas()[2], { key: "Backspace" });
    expect(areas()).toHaveLength(2);
    expect(document.activeElement).toBe(areas()[1]);
  });

  it("Tab twice makes a sub-sub-bullet, a third Tab does nothing, and Shift+Tab walks back up", () => {
    render(<BulletEditor defaultValue={"Pad work\n- 10 rds"} onSave={() => {}} />);
    fireEvent.keyDown(areas()[1], { key: "Tab" });
    expect(labels()[1]).toBe("Sub-sub-bullet");
    fireEvent.keyDown(areas()[1], { key: "Tab" });
    expect(labels()[1]).toBe("Sub-sub-bullet");
    fireEvent.keyDown(areas()[1], { key: "Tab", shiftKey: true });
    expect(labels()[1]).toBe("Sub-bullet");
    fireEvent.keyDown(areas()[1], { key: "Tab", shiftKey: true });
    expect(labels()[1]).toBe("Bullet");
    fireEvent.keyDown(areas()[1], { key: "Tab", shiftKey: true });
    expect(labels()[1]).toBe("Bullet");
  });

  it("Enter on an empty sub-bullet backs it out one level at a time (Enter, Enter, Enter from a sub-sub-bullet)", () => {
    render(<BulletEditor defaultValue={"Pad work\n- 10 rds\n  - Southpaw"} onSave={() => {}} />);
    caretAtEnd(areas()[2]);
    fireEvent.keyDown(areas()[2], { key: "Enter" });
    // First Enter: a fresh, empty sub-sub-bullet.
    expect(areas()).toHaveLength(4);
    expect(areas()[3].value).toBe("");
    expect(labels()[3]).toBe("Sub-sub-bullet");
    // Second Enter: it becomes a sub-bullet, no new row.
    fireEvent.keyDown(areas()[3], { key: "Enter" });
    expect(areas()).toHaveLength(4);
    expect(labels()[3]).toBe("Sub-bullet");
    // Third Enter: a main bullet.
    fireEvent.keyDown(areas()[3], { key: "Enter" });
    expect(areas()).toHaveLength(4);
    expect(labels()[3]).toBe("Bullet");
    // Typing there and pressing Enter again carries on as a main bullet.
    fireEvent.change(areas()[3], { target: { value: "Cool down" } });
    caretAtEnd(areas()[3]);
    fireEvent.keyDown(areas()[3], { key: "Enter" });
    expect(areas()).toHaveLength(5);
    expect(labels()[4]).toBe("Bullet");
  });

  it("saves once, when focus leaves the editor, as the text the board reads", () => {
    const onSave = vi.fn();
    render(
      <div>
        <BulletEditor defaultValue="Bag work" onSave={onSave} />
        <button type="button">elsewhere</button>
      </div>
    );
    caretAtEnd(areas()[0]);
    fireEvent.keyDown(areas()[0], { key: "Enter" });
    fireEvent.change(areas()[1], { target: { value: "3 rounds" } });
    fireEvent.keyDown(areas()[1], { key: "Tab" });
    caretAtEnd(areas()[1]);
    fireEvent.keyDown(areas()[1], { key: "Enter" });
    fireEvent.change(areas()[2], { target: { value: "Southpaw" } });
    fireEvent.keyDown(areas()[2], { key: "Tab" });

    // Moving between bullets is not a save.
    act(() => areas()[0].focus());
    expect(onSave).not.toHaveBeenCalled();

    // Leaving the editor is.
    const outside = screen.getByText("elsewhere");
    act(() => {
      fireEvent.blur(areas()[0], { relatedTarget: outside });
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("Bag work\n- 3 rounds\n  - Southpaw");
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

  it("pasting several lines makes several bullets at their levels", () => {
    render(<BulletEditor defaultValue="" onSave={() => {}} />);
    const el = areas()[0];
    el.setSelectionRange(0, 0);
    fireEvent.paste(el, { clipboardData: { getData: () => "Warm up\n- Jump rope\n  - Double unders\nSparring" } });
    expect(areas().map((x) => x.value)).toEqual(["Warm up", "Jump rope", "Double unders", "Sparring"]);
    expect(labels()).toEqual(["Bullet", "Sub-bullet", "Sub-sub-bullet", "Bullet"]);
  });

  it("the nest and un-nest buttons appear on the focused bullet, for a finger, and stop at the ends", () => {
    render(<BulletEditor defaultValue="Bag work" onSave={() => {}} />);
    expect(screen.queryByLabelText("Nest this bullet")).toBeNull();
    act(() => areas()[0].focus());
    // A main bullet can only go deeper.
    expect(screen.queryByLabelText("Un-nest this bullet")).toBeNull();
    fireEvent.click(screen.getByLabelText("Nest this bullet"));
    expect(labels()[0]).toBe("Sub-bullet");
    fireEvent.click(screen.getByLabelText("Nest this bullet"));
    expect(labels()[0]).toBe("Sub-sub-bullet");
    // A sub-sub-bullet can only come back up.
    expect(screen.queryByLabelText("Nest this bullet")).toBeNull();
    fireEvent.click(screen.getByLabelText("Un-nest this bullet"));
    expect(labels()[0]).toBe("Sub-bullet");
  });
});
