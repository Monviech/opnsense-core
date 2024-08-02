/*
 * Copyright (C) 2024 Cedrik Pischem
 * Copyright (C) 2024 Deciso B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES,
 * INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import BaseTableWidget from "./BaseTableWidget.js";

export default class IpsecTunnels extends BaseTableWidget {
    constructor() {
        super();
        this.resizeHandles = "e, w";
        this.tickTimeout = 5;
    }

    getGridOptions() {
        return {
            // Automatically triggers vertical scrolling after reaching 650px in height
            sizeToContent: 650
        };
    }

    getMarkup() {
        let $container = $('<div></div>');
        let $ipsecTunnelTable = this.createTable('ipsecTunnelTable', {
            headerPosition: 'top',
            headers: []
        });

        $container.append($ipsecTunnelTable);
        return $container;
    }

    async onWidgetTick() {
        const ipsecStatusResponse = await this.ajaxCall('/api/ipsec/Connections/isEnabled');

        if (!ipsecStatusResponse.enabled) {
            this.displayError(`${this.translations.unconfigured}`);
            return;
        }

        const responsePhase1 = await this.ajaxCall('/api/ipsec/Sessions/searchPhase1');

        if (!responsePhase1 || !responsePhase1.rows || responsePhase1.rows.length === 0) {
            this.displayError(`${this.translations.notunnels}`);
            return;
        }

        // Process Phase 1 tunnels
        this.processTunnels(responsePhase1.rows);

        try {
            // Extract all Phase 1 IDs
            const phase1Ids = responsePhase1.rows.map(tunnel => tunnel.name);

            // Fetch all Phase 2 entries using the Phase 1 IDs
            let allPhase2Entries = [];
            for (let id of phase1Ids) {
                const responsePhase2 = await this.ajaxCall('/api/ipsec/Sessions/searchPhase2', JSON.stringify({ id: id }), 'POST');
                if (responsePhase2 && responsePhase2.rows) {
                    allPhase2Entries = allPhase2Entries.concat(responsePhase2.rows);
                }
            }

            // Process Phase 2 entries if needed
            this.processPhase2Tunnels(responsePhase1.rows, allPhase2Entries);
        } catch (error) {
            console.error(this.translations.errorphase2, error);
        }
    }

    // Utility function to display errors within the widget
    displayError(message) {
        const $error = $(`<div class="error-message"><a href="/ui/ipsec/connections">${message}</a></div>`);
        $('#ipsecTunnelTable').empty().append($error);
    }

    processTunnels(newTunnels) {
        if (!this.dataChanged('', newTunnels)) {
            return; // No changes detected, do not update the UI
        }

        $('.ipsectunnels-status-icon').tooltip('hide');

        let rows = newTunnels.map(tunnel => {
            let phase1Html = `
                <div style="text-align: center;">
                    <i class="fa ${tunnel.connected ? 'fa-exchange text-success' : 'fa-exchange text-danger'} ipsectunnels-status-icon" style="cursor: pointer;"
                        data-toggle="tooltip" title="${tunnel.connected ? this.translations.online : this.translations.offline}">
                    </i>
                    &nbsp;
                    <span><b>${tunnel.phase1desc || this.translations.notavailable}</b></span>
                    <div style="margin-top: 5px; margin-bottom: 5px;">
                        <span>${tunnel['local-addrs'] || this.translations.notavailable} <span style="font-size: 20px;">↔</span> ${tunnel['remote-addrs'] || this.translations.notavailable}</span>
                    </div>
                </div>`;
            let phase2Html = this.getPhase2Html(tunnel.name); // Placeholder, will be updated with actual data
            return [phase1Html, phase2Html];
        });

        // Update the HTML table with the sorted rows
        super.updateTable('ipsecTunnelTable', rows);

        // Activate tooltips for new dynamic elements
        $('.ipsectunnels-status-icon').tooltip({container: 'body'});
    }

    getPhase2Html(phase1Id) {
        // Placeholder function to return HTML for Phase 2 data for the given Phase 1 ID
        // This will be updated dynamically in processPhase2Tunnels
        return `<div class="phase2-container" data-phase1-id="${phase1Id}" style="text-align: left;"></div>`;
    }

    processPhase2Tunnels(phase1Tunnels, phase2Tunnels) {
        const phase2Groups = phase2Tunnels.reduce((acc, phase2) => {
            acc[phase2.ikeid] = acc[phase2.ikeid] || [];
            acc[phase2.ikeid].push(phase2);
            return acc;
        }, {});

        Object.keys(phase2Groups).forEach(phase1Id => {
            const phase2Html = phase2Groups[phase1Id].map(phase2 => `
                <div class="phase2-details" style="text-align: left;">
                    <span><b>${phase2.phase2desc || this.translations.notavailable}</b></span>
                    <div style="margin-top: 5px; margin-bottom: 5px;">
                        <div><b>${this.translations.localts}:</b> ${phase2['local-ts'] || this.translations.notavailable}</div>
                        <div><b>${this.translations.remotets}:</b> ${phase2['remote-ts'] || this.translations.notavailable}</div>
                        <div><b>${this.translations.lifetime}:</b> ${phase2['life-time'] || this.translations.notavailable}</div>
                        <div><b>${this.translations.bytesin}:</b> ${phase2['bytes-in'] || this.translations.notavailable}</div>
                        <div><b>${this.translations.bytesout}:</b> ${phase2['bytes-out'] || this.translations.notavailable}</div>
                    </div>
                </div>
            `).join('');

            let $container = $(`.phase2-container[data-phase1-id="${phase1Id}"]`);
            $container.html(phase2Html);
        });
    }

    onWidgetResize(elem, width, height) {
        if (width < 450) {
            $('.phase2-container').hide();
        } else {
            $('.phase2-container').show();
        }
        return true; // Return true to force the grid to update its layout
    }
}
