import { BaseItem } from "../base_item";
import { enumColors } from "../colors";
import { enumLogicGateType, LogicGateComponent } from "../components/logic_gate";
import { enumPinSlotType } from "../components/wired_pins";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { BOOL_FALSE_SINGLETON, BOOL_TRUE_SINGLETON, isTrueItem, isTruthyItem } from "../items/boolean_item";
import { COLOR_ITEM_SINGLETONS } from "../items/color_item";
import { ShapeDefinition } from "../shape_definition";
import { ShapeItem } from "../items/shape_item";

export class LogicGateSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [LogicGateComponent]);

        this.boundOperations = {
            [enumLogicGateType.and]: this.compute_AND.bind(this),
            [enumLogicGateType.not]: this.compute_NOT.bind(this),
            [enumLogicGateType.xor]: this.compute_XOR.bind(this),
            [enumLogicGateType.or]: this.compute_OR.bind(this),
            [enumLogicGateType.transistor]: this.compute_IF.bind(this),

            [enumLogicGateType.rotater]: this.compute_ROTATE.bind(this),
            [enumLogicGateType.analyzer]: this.compute_ANALYZE.bind(this),
            [enumLogicGateType.cutter]: this.compute_CUT.bind(this),
            [enumLogicGateType.unstacker]: this.compute_UNSTACK.bind(this),
            [enumLogicGateType.shapecompare]: this.compute_SHAPECOMPARE.bind(this),
        };
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const logicComp = entity.components.LogicGate;
            const slotComp = entity.components.WiredPins;

            const slotValues = [];

            for (let i = 0; i < slotComp.slots.length; ++i) {
                const slot = slotComp.slots[i];
                if (slot.type !== enumPinSlotType.logicalAcceptor) {
                    continue;
                }
                if (slot.linkedNetwork) {
                    slotValues.push(slot.linkedNetwork.currentValue);
                } else {
                    slotValues.push(null);
                }
            }

            const result = this.boundOperations[logicComp.type](slotValues);

            if (Array.isArray(result)) {
                let resultIndex = 0;
                for (let i = 0; i < slotComp.slots.length; ++i) {
                    const slot = slotComp.slots[i];
                    if (slot.type !== enumPinSlotType.logicalEjector) {
                        continue;
                    }
                    slot.value = result[resultIndex++];
                }
            } else {
                // @TODO: For now we hardcode the value to always be slot 0
                assert(
                    slotValues.length === slotComp.slots.length - 1,
                    "Bad slot config, should have N acceptor slots and 1 ejector"
                );
                assert(slotComp.slots[0].type === enumPinSlotType.logicalEjector, "Slot 0 should be ejector");
                slotComp.slots[0].value = result;
            }
        }
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_AND(parameters) {
        assert(parameters.length === 2, "bad parameter count for AND");
        return isTruthyItem(parameters[0]) && isTruthyItem(parameters[1])
            ? BOOL_TRUE_SINGLETON
            : BOOL_FALSE_SINGLETON;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_NOT(parameters) {
        return isTruthyItem(parameters[0]) ? BOOL_FALSE_SINGLETON : BOOL_TRUE_SINGLETON;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_XOR(parameters) {
        assert(parameters.length === 2, "bad parameter count for XOR");
        return isTruthyItem(parameters[0]) ^ isTruthyItem(parameters[1])
            ? BOOL_TRUE_SINGLETON
            : BOOL_FALSE_SINGLETON;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_OR(parameters) {
        assert(parameters.length === 2, "bad parameter count for OR");
        return isTruthyItem(parameters[0]) || isTruthyItem(parameters[1])
            ? BOOL_TRUE_SINGLETON
            : BOOL_FALSE_SINGLETON;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_IF(parameters) {
        assert(parameters.length === 2, "bad parameter count for IF");
        const flag = parameters[0];
        const value = parameters[1];

        // pass through item
        if (isTruthyItem(flag)) {
            return value;
        }

        return null;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_ROTATE(parameters) {
        const item = parameters[0];
        if (!item || item.getItemType() !== "shape") {
            // Not a shape
            return null;
        }

        const definition = /** @type {ShapeItem} */ (item).definition;
        const rotatedDefinition = this.root.shapeDefinitionMgr.shapeActionRotateCW(definition);
        return this.root.shapeDefinitionMgr.getShapeItemFromDefinition(rotatedDefinition);
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {[BaseItem, BaseItem]}
     */
    compute_ANALYZE(parameters) {
        const item = parameters[0];
        if (!item || item.getItemType() !== "shape") {
            // Not a shape
            return [null, null];
        }

        const definition = /** @type {ShapeItem} */ (item).definition;
        const lowerLayer = /** @type {import("../shape_definition").ShapeLayer} */ (definition.layers[0]);
        if (!lowerLayer) {
            return [null, null];
        }

        const topRightContent = lowerLayer[0];

        if (!topRightContent || topRightContent.subShape === null) {
            return [null, null];
        }

        const newDefinition = new ShapeDefinition({
            layers: [
                [
                    { subShape: topRightContent.subShape, color: enumColors.uncolored },
                    { subShape: topRightContent.subShape, color: enumColors.uncolored },
                    { subShape: topRightContent.subShape, color: enumColors.uncolored },
                    { subShape: topRightContent.subShape, color: enumColors.uncolored },
                ],
            ],
        });

        return [
            COLOR_ITEM_SINGLETONS[topRightContent.color],
            this.root.shapeDefinitionMgr.getShapeItemFromDefinition(newDefinition),
        ];
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {[BaseItem, BaseItem]}
     */
    compute_CUT(parameters) {
        const item = parameters[0];
        if (!item || item.getItemType() !== "shape") {
            // Not a shape
            return [null, null];
        }

        const definition = /** @type {ShapeItem} */ (item).definition;
        const result = this.root.shapeDefinitionMgr.shapeActionCutHalf(definition);
        return [
            result[0].isEntirelyEmpty()
                ? null
                : this.root.shapeDefinitionMgr.getShapeItemFromDefinition(result[0]),
            result[1].isEntirelyEmpty()
                ? null
                : this.root.shapeDefinitionMgr.getShapeItemFromDefinition(result[1]),
        ];
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {[BaseItem, BaseItem]}
     */
    compute_UNSTACK(parameters) {
        const item = parameters[0];
        if (!item || item.getItemType() !== "shape") {
            // Not a shape
            return [null, null];
        }

        const definition = /** @type {ShapeItem} */ (item).definition;
        const layers = /** @type {Array<import("../shape_definition").ShapeLayer>}  */ (definition.layers);

        const upperLayerDefinition = new ShapeDefinition({
            layers: [layers[layers.length - 1]],
        });

        const lowerLayers = layers.slice(0, layers.length - 1);
        const lowerLayerDefinition =
            lowerLayers.length > 0 ? new ShapeDefinition({ layers: lowerLayers }) : null;

        return [
            lowerLayerDefinition
                ? this.root.shapeDefinitionMgr.getShapeItemFromDefinition(lowerLayerDefinition)
                : null,
            this.root.shapeDefinitionMgr.getShapeItemFromDefinition(upperLayerDefinition),
        ];
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_SHAPECOMPARE(parameters) {
        const itemA = parameters[0];
        const itemB = parameters[1];

        return itemA &&
            itemB &&
            itemA.getItemType() === "shape" &&
            itemB.getItemType() === "shape" &&
            /** @type {ShapeItem} */ (itemA).definition.getHash() ===
                /** @type {ShapeItem} */ (itemB).definition.getHash()
            ? BOOL_TRUE_SINGLETON
            : BOOL_FALSE_SINGLETON;
    }
}
