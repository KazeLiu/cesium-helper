// 创建点线面等几何方法放这里
import * as Cesium from "cesium";
import CesiumUtils from "./utils.js";
import {CesiumHeatmap} from "cesium-heatmap-es6"
import {PositionProperty} from "cesium";


export default class CesiumGeometry {

    constructor(viewer) {
        this.utils = new CesiumUtils(viewer);
        this.viewer = viewer;

    }

    /**
     * 添加entity到collection
     * @param collectionName 类名称 默认defaultCollection
     * @param entity 点
     */
    addEntityToCollection(entity, collectionName = 'defaultCollection') {
        let find = this.viewer.dataSources.getByName(collectionName)
        if (find && find.length > 0) {
            find[0].entities.add(entity);
        }
    }

    /**
     * ⚠，尚未完善，请勿使用：隐藏或显示带有附属性质的点是无法隐藏附属点
     * 比如addMarker中添加{attachImage: []} 就无法显示隐藏这个附属点
     * 按组别批量显示隐藏entity（按组名称）
     * @param type false 隐藏  true 显示
     * @param collectionName 组名
     */
    changeCollectionShowAndHide(show, collectionName = 'defaultCollection') {
        let list = this.viewer.dataSources.getByName(collectionName)
        if (list && list.length > 0) {
            list[0].show = show;
        }
    }

    /**
     * ⚠，尚未完善，请勿使用：隐藏带有附属性质的点是无法删除附属点
     * 比如addMarker中添加{attachImage: []} 就无法删除这个附属点
     * 按组别批量删除entity（按组名称）
     * @param collectionName 组名
     */
    removeCollection(collectionName) {
        let list = this.viewer.dataSources.getByName(collectionName)
        if (list && list.length > 0) {
            list[0].entities.removeAll();
        }
    }

    // 删除实体对象
    removeEntity(id) {
        let mainEntity = this.getEntityById(id);
        mainEntity.dataSource.entities.remove(mainEntity.entity);
        // 删除附属
        let defaultPrimitives = this.viewer.dataSources.getByName('defaultPrimitives')[0]
        let entities = defaultPrimitives.entities.values

        // 倒序遍历实体并安全删除满足条件的实体
        for (let entity of entities.slice().reverse()) {
            if (entity.description.getValue().searchId == id) {
                defaultPrimitives.entities.remove(entity);
            }
        }
    }

    /**
     * 根据条件查找entity
     */
    findEntitiesByCondition(condition) {
        const foundEntities = [];
        const dataSources = this.viewer.dataSources;
        dataSources._dataSources.forEach((dataSource) => {
            if (dataSource.entities) {
                dataSource.entities.values.forEach((entity) => {
                    if (condition(entity)) {
                        foundEntities.push({
                            dataSource,
                            entity
                        });
                    }
                });
            }
        });
        return foundEntities;
    };

    getEntityById(id) {
        let find = this.findEntitiesByCondition((entity) => entity.id === id);
        if (find && find.length > 0) {
            return find[0]
        } else {
            return null
        }
    }

    /**
     * 添加点
     * @param marker
     * @param collectionName
     * @returns {module:cesium.Entity}
     */
    addMarker(marker = {}, collectionName) {
        const id = this.utils.generateUUID();
        let info = Object.assign({
            scale: 0.1,
            id: id,
            name: id,
            hasMove: false,
            hasLabel: true,
            labelOption: {},
            point: {
                show: false
            }
        }, marker);

        let entity = new Cesium.Entity({
            // http://cesium.xin/cesium/cn/Documentation1.72/Entity.html
            id: info.id,
            name: info.name,
            position: this.utils.convertToCartesian3(info.position),
            point: info.point,
            description: info.description,
            hasMove: info.hasMove,
            hasLabel: info.hasLabel
        });
        if (info.iconImage) {
            entity.billboard = new Cesium.BillboardGraphics({
                image: info.iconImage,
                scale: info.scale,
                rotation: info.rotation,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            })
        } else {
            entity.point = new Cesium.PointGraphics({
                color: Cesium.Color.WHITE,
                pixelSize: 20,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            })
        }
        if (info.hasLabel) {
            this.markerAddLabel(entity, info.name, info.labelOption)
        }

        // 附加的entity
        if (info.attachImage && Array.isArray(info.attachImage) && info.attachImage.length > 0) {
            let tempEntityList = [];
            info.attachImage.forEach(attachImage => {
                let tempEntity = new Cesium.Entity({
                    id: this.utils.generateUUID(),
                    billboard: new Cesium.BillboardGraphics({
                        image: attachImage.url,
                        scale: attachImage.scale ?? 0.3,
                        rotation: attachImage.rotation ?? 0,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        pixelOffset: new Cesium.Cartesian2(attachImage.pixelOffset.x, attachImage.pixelOffset.y)
                    }),
                    position: entity.position,
                    description: {searchId: entity.id, entity}
                });
                this.addEntityToCollection(tempEntity, 'defaultPrimitives')
                tempEntityList.push(tempEntity);
            })
            entity.attachList = tempEntityList
        }
        this.addEntityToCollection(entity, collectionName)
        this.utils.unlockCamera();
        return entity;
    }

    /**
     * 点添加文字 如果本来有文字则修改 否则添加
     * @param entity
     * @param text
     * @param option 个性化设置
     */
    markerAddLabel(entity, text, option) {
        entity.label = new Cesium.LabelGraphics(Object.assign({
            text: text,
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: this.utils.colorToCesiumRGB('#000000', 0.5),
            style: Cesium.LabelStyle.FILL,
            pixelOffset: new Cesium.Cartesian2(0, 40),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            font: '14px microsoft YaHei',
        }, option))
    }

    /**
     * 添加线
     * @param polyline
     * @param collectionName
     */
    addLine(polyline = {}, collectionName) {
        const id = this.utils.generateUUID();
        let info = Object.assign({
            name: id,
            text: id,
            id: id,
            material: this.utils.colorToCesiumRGB('#23ADE5', 0.7),
        }, polyline);

        let line = new Cesium.Entity({
            id: info.id,
            name: info.name,
            polyline: {
                clampToGround: true,
                positions: this.utils.convertToCartesian3(info.positions),
                width: 3,
                material: info.material,
            },
        });
        this.addEntityToCollection(line, collectionName)
        return line;
    }

    /**
     * 添加面
     * @param polyline
     * @param collectionName
     */
    addPolygon(polyline = {}, collectionName) {
        const id = this.utils.generateUUID();
        let info = Object.assign({
            name: id,
            text: id,
            id: id,
            material: this.utils.colorToCesiumRGB('#23ADE5', 0.7),
        }, polyline);

        let polygon = new Cesium.Entity({
            id: info.id,
            name: info.name,
            polygon: {
                clampToGround: true,
                hierarchy: new Cesium.PolygonHierarchy(this.utils.convertToCartesian3(info.positions)),
                width: 3,
                material: this.utils.colorToCesiumRGB('#23ADE5', 0.7),
            },
        });
        if (info.holes) {
            let hierarchy = polygon.polygon.hierarchy.getValue(undefined)
            if (hierarchy) {
                hierarchy.holes.push(...info.holes);
            }

        }
        this.addEntityToCollection(polygon, collectionName)
        return polygon
    }

    /**
     * 历史轨迹
     * @param marker
     * @param timeAndPosition [{time:'2023-01-01 12:00:00',position:[122.4882,23.9999]},{time:'2023-01-02 12:00:00',position:[126.1321,39.2452]}]
     */
    historyLine(marker, timeAndPosition) {
        let positionProperty = new Cesium.SampledPositionProperty();
        for (let i = 0; i < timeAndPosition.length; i++) {
            positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(timeAndPosition[i].time)),
                this.utils.convertToCartesian3(timeAndPosition[i].position));
        }
        marker.position = positionProperty;
        marker.polyline = new Cesium.PolylineGraphics({
            material: this.utils.colorToCesiumRGB('#4B8BF4', 1),
            width: 2,
            clampToGround: true,
            positions: timeAndPosition.map(x => this.utils.convertToCartesian3(x.position))
        });
        // 时间范围之外 不显示点和线  取消该代码也只能保持显示线不能显示点
        let availability = new Cesium.TimeIntervalCollection();
        availability.addInterval(
            new Cesium.TimeInterval({
                start: Cesium.JulianDate.fromDate(new Date(timeAndPosition[0].time)),
                stop: Cesium.JulianDate.fromDate(new Date(timeAndPosition[timeAndPosition.length - 1].time)),
            })
        );
        marker.availability = availability;

        marker.orientation = new Cesium.VelocityOrientationProperty(positionProperty);

    }

    /**
     * 热力图 要其他的（修改颜色透明度，修改最大最小值）再说
     * @param entryList 点列表[{
     *                 "x": randomLng,
     *                 "y": randomLat,
     *                 "value": randomValue
     *             }]
     */
    addHeatMap(entryList) {
        let data = [];
        entryList.forEach(item => {
            data.push(item)
        })
        let cesiumHeatmap = new CesiumHeatmap(this.viewer,
            {
                // zoomToLayer: true, 自动到热力图范围
                points: data,
                renderType: "entity",
                heatmapDataOptions: {max: 100, min: 0},
                heatmapOptions: {
                    maxOpacity: 0.8,
                    minOpacity: 0
                }
            }
        )
        return cesiumHeatmap
    }
}
