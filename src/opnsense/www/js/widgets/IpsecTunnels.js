/*
 * Copyright (C) 2024 Cedrik Pischem
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

import BaseTableWidget from 'widget-base-table';

export default class IpsecTunnels extends BaseTableWidget {
    constructor() {
        super();
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
            headerPosition: 'none'
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

        const response = await this.ajaxCall('/api/ipsec/Sessions/searchPhase1');

        if (!response || !response.rows || response.rows.length === 0) {
            this.displayError(`${this.translations.notunnels}`);
            return;
        }

        this.processTunnels(response.rows);
    }

    // Utility function to display errors within the widget
    displayError(message) {
        const $error = $(`<div class="error-message"><a href="/ui/ipsec/connections">${message}</a></div>`);
        $('#ipsecTunnelTable'). empty().append($error);
    }

    processTunnels(newTunnels) {
        if (!this.dataChanged('', newTunnels)) {
            return; // No changes detected, do not update the UI
        }

        $('.ipsectunnels-status-icon').tooltip('hide');

        let tunnels = newTunnels.map(tunnel => ({
            phase1desc: tunnel.phase1desc || this.translations.notavailable,
            localAddrs: tunnel['local-addrs'] || this.translations.notavailable,
            remoteAddrs: tunnel['remote-addrs'] || this.translations.notavailable,
            installTime: tunnel['install-time'], // No fallback since we check if it is null
            bytesIn: tunnel['bytes-in'] != null ? this._formatBytes(tunnel['bytes-in']) : this.translations.notavailable,
            bytesOut: tunnel['bytes-out'] != null ? this._formatBytes(tunnel['bytes-out']) : this.translations.notavailable,
            connected: tunnel.connected,
            statusIcon: tunnel.connected ? 'fa-exchange text-success' : 'fa-exchange text-danger'
        }));

        // Sort by connected status, offline first then online
        tunnels.sort((a, b) => a.connected === b.connected ? 0 : a.connected ? -1 : 1);

        let onlineCount = tunnels.filter(tunnel => tunnel.connected).length;
        let offlineCount = tunnels.length - onlineCount;

        // Summary row for tunnel counts
        let summaryRow = `
            <div>
                <span><b>${this.translations.total}:</b> ${tunnels.length} - <b>${this.translations.online}:</b> ${onlineCount} - <b>${this.translations.offline}:</b> ${offlineCount}</span>
            </div>`;

        let rows = [summaryRow];

        // Generate HTML for each tunnel
        tunnels.forEach(tunnel => {
            let installTimeInfo = tunnel.installTime === null
                ? `<span style="font-size: 12px;"><em>${this.translations.nophase2connected}</em></span>`
                : `<span style="font-size: 12px;"><em>${this.translations.installtime}: ${tunnel.installTime}</em></span>`;

            let bytesInfo = tunnel.installTime !== null
                ? `<span style="font-size: 12px;"><em>${this.translations.bytesin}: ${tunnel.bytesIn} - ${this.translations.bytesout}: ${tunnel.bytesOut}</em></span>`
            : '';

            let row = `
                <div>
                    <i class="fa ${tunnel.statusIcon} ipsectunnels-status-icon" style="cursor: pointer;"
                        data-toggle="tooltip" title="${tunnel.connected ? this.translations.online : this.translations.offline}">
                    </i>
                    &nbsp;
                    <span><b>${tunnel.phase1desc}</b></span>
                    <br/>
                    <div>
                        <span>${tunnel.localAddrs} <span style="font-size: 18px;">↔</span> ${tunnel.remoteAddrs}</span>
                    </div>
                    <div>
                        ${installTimeInfo}
                    </div>
                    <div>
                        ${bytesInfo}
                    </div>
                </div>`;
            rows.push(row);
        });

        // Update the HTML table with the sorted rows
        super.updateTable('ipsecTunnelTable', rows.map(row => [row]));

        // Activate tooltips for new dynamic elements
        $('.ipsectunnels-status-icon').tooltip({container: 'body'});
    }
}
