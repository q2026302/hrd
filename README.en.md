# Sliding Number Puzzle - Game Introduction & Guide

## Game Introduction

Sliding Number Puzzle is a classic sliding puzzle game. On a 3x3 grid, there are numbered wooden tiles from 1 to 8 and one empty space. Players need to drag or click the tiles, using the empty space to move numbers, ultimately arranging the numbers in order from 1 to 8.

---

## Features

### 🪵 Wooden Toy Texture
- Three-dimensional wooden tiles with wood grain texture
- Recessed groove effect on the board, exposed wood color for empty space
- Slight pressing sensation when clicking tiles

### 🖱️ Control Methods
- **Drag**: Hold a tile and drag it to an adjacent empty space
- **Click**: Directly click on a tile adjacent to the empty space

### 📊 Helper Functions
- **Move History**: Records every move in real-time (e.g., 5↑, 3←)
- **Auto Solver**: Calculates the optimal solution
- **Step Navigation**: View the solution step by step with Previous/Next buttons, click on steps to jump directly
- **Solvability Check**: Automatically detects if the current board is solvable

---

## Interface Description

### Left Side - Game Board
- **3x3 Grid**: 9 cells, 8 with numbered wooden tiles, 1 empty space
- **Numbered Tiles**: Numbers 1-8 with three-dimensional effect
- **Empty Space**: Dark recessed groove, not clickable

### Right Side - Control Panel
1. **Control Panel**
   - **Random**: Dropdown menu with "Fully Random", "Easy Start", or "Hard Start"
   - **Manual**: Opens a popup to manually input the board layout
   - **Solve**: Calculates and displays the optimal solution steps
   - **Reset**: Returns to the initial state

2. **Information Panel**
   - **Move History**: Displays all executed moves
   - **Solution Steps**: Shows the calculated solution steps (appears after clicking Solve)

---

## Game Rules

1. **Goal**: Arrange numbers in order from 1 to 8, with the empty space in the bottom-right corner (9th cell)

   ```
   Goal State:
   ┌───┬───┬───┐
   │ 1 │ 2 │ 3 │
   ├───┼───┼───┤
   │ 4 │ 5 │ 6 │
   ├───┼───┼───┤
   │ 7 │ 8 │   │
   └───┴───┴───┘
   ```

2. **Movement Rules**:
   - Only tiles adjacent to the empty space can be moved
   - Each move slides a tile into the empty space
   - The empty space itself cannot be moved

3. **Solvability**:
   - Not all random arrangements are solvable
   - The program automatically checks if the current board is solvable
   - If unsolvable, the Solve button will show "Current board is unsolvable"

---

## Operation Guide

### Basic Moves
- **Drag**: Hold a tile and drag it to an adjacent empty space
- **Click**: Directly click on a tile adjacent to the empty space

### Random Start
Click the "Random" button and select from the dropdown:
- **Fully Random**: Completely random shuffle (150 random moves)
- **Easy Start**: Only swaps 7 and 8
- **Hard Start**: Preset complex layout

### Manual Input
1. Click the "Manual" button to open the input popup
2. Enter numbers 1-8 in the 9 cells (leave empty or enter 0 for empty space)
3. Click "Apply" to confirm

### Auto Solver
1. Click the "Solve" button to calculate the optimal solution
2. Solution steps are displayed as "number + arrow" format (e.g., 5↑ means tile 5 moves up)
3. Use "Previous/Next" buttons to view step by step
4. Click on any step label to jump directly to that step

### Move History
- Displays every move at the top of the right panel
- The most recent move is highlighted
- Format: number + direction arrow

---

## Tips & Tricks

1. **Observe the empty space**: Before each move, locate the empty space and consider which tile can move into it
2. **Start from the edges**: First fix corner numbers (1, 3, 7, 9), then handle the middle
3. **Learn from the solver**: If stuck, click Solve to learn the optimal solution
4. **Explore freely**: If you make a move different from the solution, the solution will automatically clear

---

## Frequently Asked Questions

**Q: Why are some random layouts unsolvable?**
A: Sliding puzzles have parity constraints; about half of all random arrangements are unsolvable. The program automatically detects and notifies you.

**Q: What do the arrows in the solution steps mean?**
A: Arrows indicate the direction the numbered tile moves. For example, "5↑" means tile 5 moves up one space.

**Q: How do I return to the initial state?**
A: Click the "Reset" button to return to the initial state (the state after the random start).

**Q: How do I represent an empty space in manual input?**
A: Leave the input cell empty, or enter 0 to represent an empty space.

---

## Version Information

- **Game Name**: Sliding Number Puzzle
- **Version**: 1.0
- **Design Style**: Wooden Toy Texture
- **Core Algorithm**: A* Search Algorithm + Manhattan Distance Heuristic