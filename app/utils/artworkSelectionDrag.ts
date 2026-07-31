export class ArtworkSelectionDrag {
  private targetSelected: boolean | null = null
  private readonly touchedIds = new Set<string>()

  get active(): boolean {
    return this.targetSelected !== null
  }

  start(id: string, selected: boolean): boolean {
    this.targetSelected = !selected
    this.touchedIds.clear()
    this.touchedIds.add(id)
    return true
  }

  enter(id: string, selected: boolean): boolean {
    if (this.targetSelected === null || this.touchedIds.has(id)) return false
    this.touchedIds.add(id)
    return selected !== this.targetSelected
  }

  stop(): void {
    this.targetSelected = null
    this.touchedIds.clear()
  }
}
