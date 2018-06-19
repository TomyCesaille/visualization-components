/*
 * Visualisation Components - https://github.com/amaris/visualization-components
 * Copyright (C) 2018 Amaris <rpawlak@amaris.com>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */
import * as d3 from 'd3';
import { fk, functorkeyscale, keyNotNull } from './time-series-utils';
/**
 * A component to show time series.
 */
export class TimeSeries {
    constructor() {
        this.brush = d3.brushX();
        this.yScale = d3.scaleLinear();
        this.xScale = d3.scaleTime();
        this.yScaleLabel = '';
        this.xScaleLabel = '';
        this.isZoom = false;
        // default
        this.width = 600;
        this.height = 480;
        this.drawerHeight = 80;
        this.drawerTopMargin = 10;
        this.margin = { top: 10, bottom: 20, left: 40, right: 10 };
        this.min_zoom = 0.1;
        this.max_zoom = 7;
        this.text_size = 10;
        this.yScaleFormat = this.yScale.tickFormat();
    }
    update() {
        this.width = this.container2.clientWidth;
        this.height = this.container2.clientHeight;
        if (NaN === this.width || NaN === this.height) {
            this.width = 800;
            this.height = 640;
        }
        console.info(this.width + "," + this.height);
    }
    /**
     * Builds the time serie with the given configuration.
     * @param config the initial configuration
     */
    build(config) {
        this.config = config;
        this.container2 = config.container;
        this.container2.innerHTML += "<div class='text-primary bg-warning'></div><div></div>";
        if (!this.config.frequency) {
            this.config.frequency = 1000;
        }
        if (!this.config.color) {
            this.config.color = window.getComputedStyle(this.container2.firstChild).color;
        }
        if (!this.config.axisColor) {
            this.config.axisColor = window.getComputedStyle(this.container2.children[1]).color;
        }
        if (!this.config.circleColor) {
            this.config.circleColor = window.getComputedStyle(this.container2.firstChild).backgroundColor;
        }
        if (typeof config.data === "string") {
            d3.json(this.config.data, (error, rootData) => {
                this.buildFromData(rootData);
                this.createChart();
            });
        }
        else {
            this.buildFromData(config.data);
            this.createChart();
        }
        if (this.config.update) {
            this.update_function = setInterval(this.updateData, this.config.frequency, this);
        }
    }
    remove_update() {
        clearInterval(this.update_function);
    }
    updateData(serie) {
        d3.json(serie.config.update, (error, rootData) => {
            if (serie.data[serie.data.length - 1].id != rootData.id) {
                console.log(serie.data[serie.data.length - 1].id);
                console.log(rootData.id);
                let value = { id: rootData.id, x: new Date(rootData.x), y: rootData.y, a: rootData.a };
                serie.data.push(value);
                if (!serie.isZoom) {
                    serie.createLines();
                    serie.drawSerie();
                    serie.drawMiniDrawer();
                }
            }
        });
    }
    buildFromData(rootData) {
        if (typeof rootData[0].x === "string") {
            for (let i = 0; i < rootData.length; ++i) {
                rootData[i].x = new Date(rootData[i].x);
            }
        }
        this.data = rootData;
    }
    createChart() {
        this.update();
        // Compute mins max for the serie
        const extentY = d3.extent(this.data, data => data.y);
        this.min = extentY[0];
        this.max = extentY[1];
        const extentX = d3.extent(this.data, data => data.x);
        this.dateMin = extentX[0];
        this.dateMax = extentX[1];
        // Set scales
        this.yScale
            .range([this.height - this.margin.top - this.margin.bottom - this.drawerHeight - this.drawerTopMargin, 0])
            .domain([this.min, this.max])
            .nice();
        this.xScale
            .range([0, this.width - this.margin.left - this.margin.right])
            .domain([this.dateMin, this.dateMax])
            .nice();
        // If user specify domain
        if (this.yFixeDomain) {
            // for showing 0 :
            // chart.addSerie(...)
            //    .yscale.domain([0])
            if (this.yFixeDomain.length === 1) {
                this.yFixeDomain.push(this.yScale.domain()[1]);
            }
            this.yScale.domain(this.yFixeDomain);
        }
        if (this.xFixeDomain) {
            this.xScale.domain(this.xFixeDomain);
        }
        this.fullXScale = this.xScale.copy();
        // Create svg
        this.svg = d3.select(this.container2)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);
        // Clipping for scrolling in focus area
        this.svg
            .append('defs')
            .append('clipPath')
            .attr('id', 'clip')
            .append('rect')
            .attr('width', this.width - this.margin.left - this.margin.right)
            .attr('height', this.height - this.margin.bottom - this.drawerHeight - this.drawerTopMargin)
            .attr('y', -this.margin.top);
        // Container for focus area
        this.container = this.svg
            .insert('g', "rect.mouse-catch")
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`)
            .attr('clip-path', 'url(#clip)');
        this.serieContainer = this.container.append('g').attr('class', 'draw-container');
        this.annotationsContainer = this.container.append('g');
        // Mini container at the bottom
        this.drawerContainer = this.svg
            .append('g')
            .attr('class', 'mini-draw-container')
            .attr('transform', `translate(${this.margin.left},${(this.height - this.drawerHeight - this.margin.bottom)})`);
        // Vertical line moving with mouse tip
        this.mousevline = this.svg
            .append('g')
            .datum({
            x: new Date(),
            visible: false
        });
        this.mousevline
            .append('line')
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', this.yScale.range()[0])
            .attr('y2', this.yScale.range()[1])
            .attr('class', 'd3_timeseries mousevline');
        // Update mouse vline
        this.mousevlineUpdate();
        const xAxis = d3.axisBottom(this.xScale).tickFormat(this.xScale.tickFormat());
        const yAxis = d3.axisLeft(this.yScale).tickFormat(this.yScaleFormat);
        this.brush.extent([
            [this.fullXScale.range()[0], 0],
            [this.fullXScale.range()[1], this.drawerHeight - this.drawerTopMargin]
        ])
            .on('brush', () => {
            this.isZoom = true;
            const selection = d3.event.selection;
            this.xScale.domain(selection.map(this.fullXScale.invert, this.fullXScale));
            this.drawSerie();
            this.svg.select(".focus.x.axis").call(xAxis);
            this.mousevlineUpdate();
            this.updatefocusRing();
        })
            .on('end', () => {
            this.isZoom = false;
            const selection = d3.event.selection;
            if (selection === null) {
                this.xScale.domain(this.fullXScale.domain());
                this.drawSerie();
                this.svg.select(".focus.x.axis").call(xAxis);
                this.mousevlineUpdate();
                this.updatefocusRing();
            }
        });
        this.svg
            .append('g')
            .attr('class', 'd3_timeseries focus x axis')
            .attr("transform", `translate(${this.margin.left},
          ${(this.height - this.margin.bottom - this.drawerHeight - this.drawerTopMargin)})`)
            .call(xAxis);
        this.drawerContainer
            .append('g')
            .attr('class', 'd3_timeseries x axis')
            .attr("transform", `translate(0, ${this.drawerHeight})`)
            .call(xAxis);
        this.drawerContainer.append("g")
            .attr("class", "d3_timeseries brush")
            .call(this.brush)
            .attr('transform', `translate(0, ${this.drawerTopMargin})`)
            .attr("height", (this.drawerHeight - this.drawerTopMargin));
        this.svg
            .append('g')
            .attr('class', 'd3_timeseries y axis')
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)
            .call(yAxis)
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -this.margin.top - d3.mean(this.yScale.range()))
            .attr("dy", ".71em")
            .attr('y', -this.margin.left + 5)
            .style("text-anchor", "middle")
            .text(this.yScaleLabel);
        // Catch event for mouse tip
        this.svg
            .append('rect')
            .attr('width', this.width)
            .attr('class', 'd3_timeseries mouse-catch')
            .attr('height', this.height - this.drawerHeight)
            .style('opacity', 0)
            .on('mousemove', this.mouseMove.bind(this))
            .on('mouseout', this.mouseOut.bind(this));
        this.tooltipDiv = d3.select(this.container2)
            .style('position', 'relative')
            .append('div')
            .attr('class', 'd3_timeseries tooltip')
            .style('opacity', 0);
        this.createLines();
        this.drawSerie();
        this.drawMiniDrawer();
    }
    mousevlineUpdate() {
        this.mousevline
            .attr('transform', (d) => {
            return `translate(${(this.margin.left + this.xScale(d.x))}, ${this.margin.top})`;
        })
            .style('opacity', (d) => {
            return d.visible ? 1 : 0;
        });
    }
    ;
    xScaleFormat(x) {
        return x.toLocaleString();
    }
    drawSerie() {
        if (!this.linepath) {
            const linepath = this.serieContainer
                .append("path")
                .datum(this.data)
                .attr('class', 'd3_timeseries line')
                .attr('d', this.line)
                .attr('stroke', this.config.color)
                .attr('stroke-linecap', 'round')
                .attr('stroke-width', 1.5)
                .attr('fill', 'none');
            this.draw_circles();
            this.linepath = linepath;
        }
        else {
            this.linepath.attr('d', this.line);
            this.draw_circles();
        }
        // hack to force the axis color when zooming or moving the curve
        this.svg.selectAll(".axis").selectAll("path").attr("stroke", this.config.axisColor);
        this.svg.selectAll(".axis").selectAll("line").attr("stroke", this.config.axisColor);
        this.svg.selectAll(".axis").selectAll("text").attr("fill", this.config.axisColor);
    }
    draw_circles() {
        d3.select("#" + this.container2.id + " svg").selectAll(".draw-container").selectAll("circle").remove();
        d3.select("#" + this.container2.id + " svg").selectAll(".draw-container")
            .append("circle")
            .attr("r", (!this.data[0].a || this.data[0].a === undefined) ? 0 : 5.5)
            .attr("fill", "none")
            .attr('stroke-width', 3.5)
            .attr('stroke', this.config.circleColor)
            .attr('stroke-linecap', 'round')
            .attr("cx", this.xScale(this.data[0].x))
            .attr("cy", this.yScale(this.data[0].y));
        //  draw others circle of anomalies
        const anomalies = d3.select("#" + this.container2.id + " svg").selectAll(".draw-container").selectAll("circle")
            .data(this.data)
            .enter().append("circle")
            .attr("r", (d) => (!d.a) ? 0 : 5.5)
            .attr("fill", "none")
            .attr('stroke-width', 3.5)
            .attr('stroke', this.config.circleColor)
            .attr('stroke-linecap', 'round')
            .attr("cx", (d) => this.xScale(d.x))
            .attr("cy", (d) => this.yScale(d.y))
            .attr("visible", false);
    }
    updatefocusRing(xDate) {
        let s = this.annotationsContainer.selectAll("circle.d3_timeseries.focusring");
        if (xDate === null) {
            s = s.data([]);
        }
        else {
            s = s.data([{
                    x: xDate,
                    item: this.config.find(xDate),
                    color: this.config.color
                }].filter((d) => d.item && d.item.y));
        }
        s.transition()
            .duration(50)
            .attr('cx', (d) => this.xScale(d.item.x))
            .attr('cy', (d) => this.yScale(d.item.y));
        s.enter()
            .append("circle")
            .attr('class', 'd3_timeseries focusring')
            .attr('fill', 'none')
            .attr('stroke-width', 2)
            .attr('r', 5)
            .attr('stroke', fk('color'));
        s.exit().remove();
    }
    mouseMove() {
        const x = this.xScale.invert(d3.mouse(this.container.node())[0]);
        this.mousevline.datum({ x: x, visible: true });
        this.mousevlineUpdate();
        this.updatefocusRing(x);
        this.updateTip(x);
    }
    mouseOut() {
        this.mousevline.datum({ x: null, visible: false });
        this.mousevlineUpdate();
        this.updatefocusRing(null);
        this.updateTip(null);
    }
    updateTip(xDate) {
        if (xDate === null) {
            this.tooltipDiv.style('opacity', 0);
        }
        else {
            const s = {
                item: this.config.find(xDate),
                options: {}
            };
            this.tooltipDiv
                .style('opacity', 0.9)
                .style('left', `${(this.margin.left + 5 + this.xScale(xDate))}px`)
                .style('top', "0px")
                .html(this.tipFunction(xDate, s));
        }
    }
    tipFunction(date, serieItem) {
        let spans = '';
        let noDescription = "No Description";
        if (serieItem.item && serieItem.item.y) {
            spans = `<table style="border:none">
                <tr
                  <td style="color: ${this.config.axisColor}; text-align:right"> Value : ${this.yScaleFormat(serieItem.item.y)}</td>
                </tr>
                <tr>
                  <td style="color: ${this.config.color}">${serieItem.item.description ? serieItem.item.description : noDescription}</td>
                </tr>
                <tr>
                  <td style="color: ${this.config.circleColor}">${serieItem.item.anomaly_description ? serieItem.item.anomaly_description : noDescription}</td>
                </tr>
              </table>`;
        }
        return `<h4>${this.xScaleFormat(d3.timeDay(date))}</h4>${spans}`;
    }
    ;
    createLines() {
        // https://github.com/d3/d3-shape/blob/master/README.md#curves
        this.interpolationFunction = this.getInterpolationFunction(this.config) || d3.curveLinear;
        const drawLine = d3.line()
            .x(functorkeyscale('x', this.xScale))
            .y(functorkeyscale('y', this.yScale))
            .curve(d3.curveLinear /*serie.interpolationFunction*/)
            .defined(keyNotNull('y'));
        this.line = drawLine;
        this.config.find = (date) => {
            const bisect = d3.bisector(fk('x')).left;
            const i = bisect(this.config.data, date) - 1;
            if (i === -1) {
                return null;
            }
            // Look to far after serie is defined
            if (i === this.data.length - 1 &&
                this.data.length > 1 &&
                Number(date) - Number(this.data[i].x) > Number(this.data[i].x) - Number(this.data[i - 1].x)) {
                return null;
            }
            return this.data[i];
        };
    }
    getInterpolationFunction(serie) {
        // To uppercase for d3 curve name
        const curveName = 'curve';
        const curveNames = [
            { curveLinear: d3.curveLinear },
            { curveStep: d3.curveStep },
            { curveStepBefore: d3.curveStepBefore },
            { curveStepAfter: d3.curveStepAfter },
            { curveBasis: d3.curveBasis },
            { curveCardinal: d3.curveCardinal },
            { curveMonotoneX: d3.curveMonotoneX },
            { curveCatmullRom: d3.curveCatmullRom }
        ];
        const curve = curveNames.filter((curve) => curveName === Object.keys(curve)[0]);
        return curve[0];
    }
    drawMiniDrawer() {
        const smallyScale = this.yScale
            .copy()
            .range([this.drawerHeight - this.drawerTopMargin, 0]);
        const serie = this.config;
        const drawLine = d3.line()
            .x(functorkeyscale('x', this.fullXScale))
            .y(functorkeyscale('y', smallyScale))
            //.curve(serie.interpolationFunction)
            .curve(d3.curveLinear)
            .defined(keyNotNull('y'));
        const linepath = this.drawerContainer
            .insert("path", ":first-child")
            .datum(this.data)
            .attr('class', 'd3_timeseries.line')
            .attr('transform', `translate(0,${this.drawerTopMargin})`)
            .attr('d', drawLine)
            .attr('stroke', this.config.color)
            .attr('stroke-width', 1.5)
            .attr('fill', 'none');
        d3.select("#" + this.container2.id + " svg").selectAll(".mini-draw-container").selectAll("circle").remove();
        d3.select("#" + this.container2.id + " svg").selectAll(".mini-draw-container")
            .append("circle")
            .attr("r", (!this.data[0].a || this.data[0].a === undefined) ? 0 : 1.5)
            .attr("fill", "none")
            .attr('stroke-width', 3.5)
            .attr('stroke', this.config.circleColor)
            .attr('stroke-linecap', 'round')
            .attr("cx", this.xScale(this.data[0].x))
            .attr("cy", smallyScale(this.data[0].y) + this.drawerTopMargin);
        //  draw others circle of anomalies
        const anomalies = d3.select("#" + this.container2.id + " svg").selectAll(".mini-draw-container").selectAll("circle")
            .data(this.data)
            .enter().append("circle")
            .attr("r", (d) => (!d.a) ? 0 : 1.5)
            .attr("fill", "none")
            .attr('stroke-width', 3.5)
            .attr('stroke', this.config.circleColor)
            .attr('stroke-linecap', 'round')
            .attr("cx", (d) => this.fullXScale(d.x))
            .attr("cy", (d) => smallyScale(d.y) + this.drawerTopMargin)
            .attr("visible", false);
        if (serie.hasOwnProperty('stroke-dasharray')) {
            linepath.attr('stroke-dasharray', serie['stroke-dasharray']);
        }
    }
}
//# sourceMappingURL=time-series.js.map