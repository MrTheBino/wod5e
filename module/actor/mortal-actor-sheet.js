/* global DEFAULT_TOKEN, Dialog, duplicate, game, mergeObject, TextEditor */

// Export this function to be used in other scripts
import { CoterieActorSheet } from './coterie-actor-sheet.js'
import { rollDice } from './roll-dice.js'

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {CoterieActorSheet}
 */

export class MortalActorSheet extends CoterieActorSheet {
  /** @override */
  static get defaultOptions () {
    // Define the base list of CSS classes
    const classList = ['vtm5e', 'sheet', 'actor', 'mortal']

    // If the user's enabled darkmode, then push it to the class list
    if (game.settings.get('vtm5e', 'darkTheme')) {
      classList.push('dark-theme')
    }

    return mergeObject(super.defaultOptions, {
      classes: classList,
      template: 'systems/vtm5e/templates/actor/mortal-sheet.html',
      width: 940,
      height: 700,
      tabs: [{
        navSelector: '.sheet-tabs',
        contentSelector: '.sheet-body',
        initial: 'stats'
      }]
    })
  }

  constructor (actor, options) {
    super(actor, options)
    this.isCharacter = true
    this.hunger = false
    this.hasBoons = true
  }

  /** @override */
  get template () {
    if (!game.user.isGM && this.actor.limited) return 'systems/vtm5e/templates/actor/limited-sheet.html'
    return 'systems/vtm5e/templates/actor/mortal-sheet.html'
  }

  /* -------------------------------------------- */

  /** @override */
  async getData () {
    const data = await super.getData()
    // TODO: confirm that I can finish and use this list
    data.sheetType = `${game.i18n.localize('VTM5E.Mortal')}`

    // Encrich editor content
    data.enrichedTenets = await TextEditor.enrichHTML(this.object.system.headers.tenets, { async: true })
    data.enrichedTouchstones = await TextEditor.enrichHTML(this.object.system.headers.touchstones, { async: true })
    data.enrichedBane = await TextEditor.enrichHTML(this.object.system.headers.bane, { async: true })

    // Prepare items.
    if (this.actor.type === 'mortal') {
      this._prepareItems(data)
    }

    return data
  }

  /**
     * Organize and classify Items for all sheets.
     *
     * @param {Object} actorData The actor to prepare.
     * @return {undefined}
     * @override
     */
  _prepareItems (sheetData) {
    super._prepareItems(sheetData)
    const actorData = sheetData.actor

    // Initialize containers.
    const specialties = []
    const boons = []
    const customRolls = []

    // Iterate through items, allocating to containers
    for (const i of sheetData.items) {
      i.img = i.img || DEFAULT_TOKEN
      if (i.type === 'specialty') {
        // Append to specialties.
        specialties.push(i)
      } else if (i.type === 'boon') {
        // Append to boons.
        boons.push(i)
      } else if (i.type === 'customRoll') {
        // Append to custom rolls.
        customRolls.push(i)
      }
    }

    // Assign and return
    actorData.specialties = specialties
    actorData.boons = boons
    actorData.customRolls = customRolls
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return

    // Rollable abilities.
    html.find('.custom-rollable').click(this._onCustomVampireRoll.bind(this))
    html.find('.specialty-rollable').click(this._onCustomVampireRoll.bind(this))

    // Rollable abilities.
    html.find('.vrollable').click(this._onRollDialog.bind(this))
  }

  /**
   * Handle clickable Vampire rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollDialog (event) {
    event.preventDefault()
    const element = event.currentTarget
    const dataset = element.dataset
    let options = ''

    for (const [key, value] of Object.entries(this.actor.system.abilities)) {
      options = options.concat(`<option value="${key}">${game.i18n.localize(value.name)}</option>`)
    }

    const template = `
      <form>
          <div class="form-group">
              <label>${game.i18n.localize('VTM5E.SelectAbility')}</label>
              <select id="abilitySelect">${options}</select>
          </div>  
          <div class="form-group">
              <label>${game.i18n.localize('VTM5E.Modifier')}</label>
              <input type="text" id="inputMod" value="0">
          </div>  
          <div class="form-group">
              <label>${game.i18n.localize('VTM5E.Difficulty')}</label>
              <input type="text" min="0" id="inputDif" value="0">
          </div>
      </form>`

    let buttons = {}
    buttons = {
      draw: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize('VTM5E.Roll'),
        callback: async (html) => {
          const ability = html.find('#abilitySelect')[0].value
          const modifier = parseInt(html.find('#inputMod')[0].value || 0)
          const difficulty = parseInt(html.find('#inputDif')[0].value || 0)
          const abilityVal = this.actor.system.abilities[ability].value
          const abilityName = game.i18n.localize(this.actor.system.abilities[ability].name)
          const numDice = abilityVal + parseInt(dataset.roll) + modifier
          rollDice(numDice, this.actor, `${dataset.label} + ${abilityName}`, difficulty, this.hunger)
          // this._vampireRoll(numDice, this.actor, `${dataset.label} + ${abilityName}`, difficulty)
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('VTM5E.Cancel')
      }
    }

    new Dialog({
      title: game.i18n.localize('VTM5E.Rolling') + ` ${dataset.label}...`,
      content: template,
      buttons: buttons,
      default: 'draw'
    }).render(true)
  }

  _onCustomVampireRoll (event) {
    event.preventDefault()
    const element = event.currentTarget
    const dataset = element.dataset
    if (dataset.dice1 === '') {
      const dice2 = this.actor.system.skills[dataset.dice2.toLowerCase()].value
      dataset.roll = dice2 + 1 // specialty modifier
      dataset.label = dataset.name
      this._onRollDialog(event)
    } else {
      const dice1 = this.actor.system.abilities[dataset.dice1.toLowerCase()].value
      const dice2 = this.actor.system.skills[dataset.dice2.toLowerCase()].value
      const dicePool = dice1 + dice2
      rollDice(dicePool, this.actor, `${dataset.name}`, 0, this.hunger)
    }
  }
}