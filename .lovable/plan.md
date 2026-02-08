
# Plan: Adjust Mobile Background Photo Layout

## What You Want
1. Remove the photo background from behind the Core Values banner
2. Keep the photo background behind the "No Limits Academy is more than a boxing gym..." text section
3. Adjust the photo position so the coach's head isn't cut off

## How I'll Do It

### 1. Restructure the Mobile Layout
Currently, the background photo spans the entire section. I'll split it so:
- **Core Values banner** → Solid background (no photo behind it)
- **Text content area** → Photo background with the coach visible

### 2. Move the Core Values Banner Above the Background Photo Area
- Place the Core Values banner in its own container with a solid `bg-background`
- The faded photo background will only cover the text content below it

### 3. Adjust Photo Positioning
- Change `object-center` to `object-top` so the photo shows more of the top (where the coach's head is)
- This prevents the coach's head from being cut off

## Technical Details

**File to edit:** `src/components/sections/AboutSection.tsx`

**Changes:**
- Wrap the text content (headline, body, tagline) in a `relative` container that has its own background image
- Move the Core Values banner outside this background area on mobile
- Use `object-top` instead of `object-center` to show more of the coach's head
- Keep the solid background behind the Core Values banner
