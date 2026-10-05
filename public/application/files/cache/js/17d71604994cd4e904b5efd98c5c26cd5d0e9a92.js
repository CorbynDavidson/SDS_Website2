/*
 * Software by John Liddiard (aka JohntheFish)
 * www.c5magic.co.uk
 *
 * This package contains software copyright and proprietary to John Liddiard
 *
 */

(function ($) {
    /*
    No messing in edit mode or dashboard
    */
    if (CCM_EDIT_MODE || window.location.href.indexOf('/dashboard/') > 0) {
        return;
    }

    $(document).ready(function () {

        /*
         * jQuery plugin: defaultVal()
         * Returns the element's reset value in priority order:
         *  data-default_value attribute (custom default)
         *  ccm-passed-value attribute (Concrete CMS)
         *  browser defaultValue/defaultChecked
         */
        if (typeof $.fn.defaultVal !== 'function') {

            $.fn.defaultVal = function () {
                const el = this[0];
                if (!el) return;

                const $el = $(el);

                // 1. Custom default via data-default_value
                const custom = $el.attr('data-default_value');
                if (custom !== undefined) {
                    if (el.type === 'checkbox' /*|| el.type === 'radio'*/) {
                        return custom === '1' || custom === 'true';
                    }
                    return String(custom);
                }

                // 2. Concrete CMS passed value
                const passed = $el.attr('ccm-passed-value');
                if (passed !== undefined) {
                    if (el.type === 'checkbox' /*|| el.type === 'radio'*/) {
                        return passed === '1' || passed === 'true';
                    }
                    return String(passed);
                }

                // 3. Browser defaults

                // SELECT elements
                if (el.tagName === 'SELECT') {
                    const opt = el.querySelector('option[selected]');
                    const val = opt ? opt.value : (el.options[0] ? el.options[0].value : '');
                    return String(val);
                }

                // CHECKBOX / RADIO
                if (el.type === 'checkbox' || el.type === 'radio') {
                    return el.defaultChecked;
                }

                // Everything else
                return String(el.defaultValue);
            };

        } else {
            console.warn('jQuery plugin defaultVal conflict. This may affect Form Reform reset functionality');
        }


        /*
         * jQuery plugin: resetFields()
         * Resets:
         * - the element itself if it's an input/select/textarea
         * - OR all such elements inside it
         * Uses .defaultVal() for consistency
         */
        if (typeof $.fn.resetFields !== 'function') {

            $.fn.resetFields = function () {
                const set_value = function (el, v) {
                    //console.log(el.id+'['+el.type+']:='+v+' '+$(el).val()); // debug code
                    if (el.type === 'checkbox') {
                        $(el).prop('checked', !!v);
                        return;
                    }
                    if (el.type === 'radio') {
                        if (!!v) {
                            $(el).prop('checked', true);
                        }
                        return;
                    }
                    $(el).val(v);
                }

                return this.each(function () {
                    const $root = $(this);

                    // Case 1: the element itself IS a form control
                    if ($root.is('input, select, textarea')) {
                        const el = this;
                        const def = $root.defaultVal();
                        set_value(el, def);
                        return;
                    }

                    // Case 2: the element is a container
                    $root.find('input, select, textarea').each(function () {
                        const el = this;
                        const $el = $(this);
                        const def = $el.defaultVal();
                        set_value(el, def);
                    });
                });
            };

        } else {
            console.warn('jQuery plugin resetFields conflict. This may affect Form Reform reset functionality');
        }


        /*
         * Just in case the mime type issue crops up
         */
        var clean_json = function (msg) {
            if (typeof msg === 'string' && msg.indexOf('{') === 0) {
                try {
                    var result2 = JSON.parse(msg);
                    if (result2) {
                        return result2;
                    }
                } catch (e) {
                }
            }
            return msg;
        };

        /*
         * General purpose closer for alerts. Catch anything the theme/framework doesn't catch for us
         * already.
         */
        var handle_alerts = function () {
            $('.form-reform-control.form-reform-message').find('.btn-close,.alert__close,.close')
                .off('click.dismiss_alert')
                .on('click.dismiss_alert', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    $(this).closest('.alert,.alert-box').remove();
                });
        };
        handle_alerts();

        /*
         * ToDo - document level handlers and filter to catch the elements we want, so it automatically catches
         *  forms rendered by ajax. Maybe split the submit handling off from the error handling.
         */


        /*
        * Handle custom validation messages. Where found, replace the browser
        * default validation message.
        *
        * https://stackoverflow.com/questions/5272433/html5-form-required-attribute-set-custom-validation-message
        * https://developer.mozilla.org/en-US/docs/Web/API/HTMLObjectElement/validationMessage
        * https://reactgo.com/html5-custom-validation-message/
        *
        * https://developer.mozilla.org/en-US/docs/Web/API/Constraint_validation
        * https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#the-constraint-validation-api
        *
        * https://stackoverflow.com/questions/7920742/delay-html5-invalid-pseudo-class-until-the-first-event
        *
        * Conflict https://github.com/twbs/bootstrap/issues/24847 https://github.com/twbs/bootstrap/issues/32733
        */
        /*
         * Mark all inputs that get validated
         */
        $('.form-reform-input').each(function () {
            var this_input = $(this);
            var this_el = this_input.get(0);
            if (this_el.willValidate) {
                this_input.addClass('form_reform_front_end_validation')
            }
        });

        /*
         * TODO - could have a more advanced state machine for managing this. First check could
         *  maybe only be made when the user has finished interacting. After that check continuously.
         */

        $('.form-reform-input.form_reform_front_end_validation').each(function () {
            var this_input = $(this);
            var this_el = this_input.get(0);
            if (this_el.willValidate) {
                this_input.on('invalid', function (ev) {
                    /*
                     * Where we don't have custom validation and we do have default validation,
                     * Convert default validation into custom validation
                     */
                    var this_msg = this_input.attr('validationmessage');
                    if (!this_msg || this_msg === '---') {
                        this_msg = this_el.validationMessage;
                    }

                    if (!ev.target.validity.valid && this_msg) {
                        this_el.setCustomValidity(this_msg);
                        this_input.addClass('is-invalid').closest('.form-group.form-reform-control').addClass('is-invalid');
                    } else {
                        this_el.setCustomValidity('');
                        this_input.addClass('is-invalid').closest('.form-group.form-reform-control').addClass('is-invalid');
                    }
                });

                var t;
                this_input.on('input', function (ev) {
                    this_el.setCustomValidity('');
                    if (this_el.reportValidity()) {
                        clearTimeout(t); // debounce a bit, give them a chance to type
                        this_input.one('mouseup mouseout unfocus change', function () {
                            clearTimeout(t);
                            t = setTimeout(function () {
                                if (this_el.reportValidity()) {
                                    this_input.removeClass('is-invalid').closest('.form-group.form-reform-control').removeClass('is-invalid');
                                }
                            }, 500);
                        });
                    } else {
                        this_input.removeClass('is-invalid').closest('.form-group.form-reform-control').removeClass('is-invalid');
                    }
                });

                if (this_input.hasClass('non-empty-option-required')) {
                    this_input.on('change', function () {
                        if ($(this).val()) {
                            this_el.setCustomValidity('');
                            this_input.removeClass('is-invalid').closest('.form-group.form-reform-control').removeClass('is-invalid');
                        } else {
                            var this_msg = this_input.attr('validationmessage');
                            if (!this_msg || this_msg === '---') {
                                this_msg = this_el.validationMessage;
                            }
                            this_el.setCustomValidity(this_msg);
                            this_input.addClass('is-invalid').closest('.form-group.form-reform-control').addClass('is-invalid');
                        }
                    });
                }
            }
        });


        /*
         * Some basic submit handling, with an onward trigger for any specialised submit handling.
         * The event is not cancelled, it can also cascade to other submit handlers.
         *
         * The click handler makes a note of the button and lists alternate buttons.
         * If anything is invalid, the submit won't happen. If in a MT tab, we
         * navigate to the last tab with an invalid input and flag it.
         *
         * If all valid, the submit handler than makes use of the recorded button
         * info to make sure the associated data matches the bID
         */
        var clicked_submit;
        var other_submits;
        var this_form_all_controls;
        var submitting_bid;

        var mark_sumitted_controls = function () {
            this_form_all_controls.not('[disabled]').filter(':input').closest('.form-group.form-reform-control').not('.form-reform-no-validation').addClass('was-validated');
        }

        var set_temp_disable_all = function () {
            this_form_all_controls.not('[disabled]') // only mess with controls not otherwise disabled
                .attr("disabled", true)
                .addClass('jl_form_reform_temporarily_disabled')
                .trigger('set_disabled.form_reform');
            clicked_submit
                .attr("disabled", true)
                .addClass('jl_form_reform_temporarily_disabled');
        };
        var clear_temp_disable_all = function () {
            this_form_all_controls
                .filter('.jl_form_reform_temporarily_disabled')
                .removeClass('jl_form_reform_temporarily_disabled')
                .attr('disabled', false)
                .trigger('clear_disabled.form_reform')
        };

        $('.form-reform-control .form-reform-submit').on('click', function (ev) {
            var this_control = $(this);
            var this_form_id = this_control.attr('form');
            if (!this_form_id) {
                this_form_id = 'form_reform';
            }
            var this_submit_action = this_control.attr('data-action'); // action can be empty for self!!
            var this_bid = this_control.attr('data-bid');
            var this_form = $('#' + this_form_id);
            if (this_form.length !== 1 ||
                !this_bid || this_bid.length < 1
            ) {
                return;
            }
            this_form.attr('action', this_submit_action);
            submitting_bid = this_bid;
            clicked_submit = this_control;
            other_submits = $('.form-reform-control .form-reform-submit[form="' + this_form_id + '"]').not(this_control);
            this_form_all_controls = $('.form-reform-control').find('[form="' + this_form_id + '"], [data-form_name="' + this_form_id + '"] ');

            mark_sumitted_controls();

            /*
             * Respect the novalidate attribute
             */
            if (this_control.is('[novalidate]') || this_control.is('[formnovalidate]')) {
                return;
            }


            /*
             * Do we have anything invalid? We are interested in the first one.
             * This allows the form to work through them in sequence.
             */
            var notify_this_invalid_input = null;
            this_form_all_controls.each(function () {
                var this_input = $(this);
                var this_el = this_input.get(0);
                if (this_el && this_el.checkValidity && this_el.checkValidity() === false) {
                    var name = this_input.attr('name');
                    if (name && this_input.is(':invalid')) {
                        notify_this_invalid_input = this_input;
                        return false; // if we remove this, we get reverse sequence
                    }
                }
            });
            /*
             * Yes, we have one.
             * If its in an invisible tab, we navigate to its tab and flag it.
             * Otherwise there are no tabs or its the current tab, so flag it
             * immediately (a short timeout to let other event cascade settle
             * or we end up with a race).
             */
            if (notify_this_invalid_input) {
                var tab = notify_this_invalid_input.closest('.jl_magic_tabs_divider');
                if (tab.length && !tab.is(':visible')) {
                    var dodgy_tab = tab.attr('id');
                    this_form_all_controls.off('invalid.submit_click');
                    $('a[href="#' + dodgy_tab + '"').trigger('click');
                    tab.one('jl_magic_tabs_done', function () {
                        setTimeout(function () {
                            notify_this_invalid_input.focus().trigger('input');
                            notify_this_invalid_input.get(0).reportValidity();
                        }, 100);
                    });
                } else {
                    setTimeout(function () {
                        notify_this_invalid_input.focus().trigger('input');
                        notify_this_invalid_input.get(0).reportValidity();
                    }, 100);
                }
                return false;
            }
        });

        /*
         * Submit only happens for a valid form, after the click handler has validated the form
         */
        $('form.form-reform-control-submit').on('submit', function (ev) {
            var this_form = $(this);

            var showLoader = function () {
                this_form.addClass('form-reform-loading');
                $('.form-reform-spinner').trigger('show_spinner.form_reform', [this_form]);
                if ($.fn.dialog && $.fn.dialog.showLoader) {
                    $.fn.dialog.showLoader();
                }
            };
            var hideLoader = function () {
                this_form.trigger('clear_spinner.form_reform');
                this_form.removeClass('form-reform-loading');
                if ($.fn.dialog && $.fn.dialog.hideLoader) {
                    $.fn.dialog.hideLoader();
                }
            };

            var this_form_id = this_form.attr('id');


            /*
             * Mark controls that are in the current submission
             */
            mark_sumitted_controls();

            /*
             * We could have multiple hidden inputs with different bID. We need this control's bID in all
             * of them so we don't have any confusion at the end.
             * Also find any such associated with other submits and disable them.
             *
             * Disabled needs to be reversed when we do ajax submissions
             * Anything we disable is assigned jl_form_reform_temporarily_disabled so we
             * can undo it later.
             */
            this_form_all_controls.filter('[name="form-reform-submit-bid"]').val(submitting_bid);
            this_form_all_controls.trigger('form_submitting.form_reform');

            other_submits.not('[disabled]').attr("disabled", true).addClass('jl_form_reform_temporarily_disabled');
            other_submits.closest('.form-reform-control').find(':input')
                .not('[disabled]').attr("disabled", true).addClass('jl_form_reform_temporarily_disabled');

            this_form.addClass('submitting');
            showLoader();

            /*
             * We want the form to be submitted, so cannot disable it
             * before returning. A 1ms delay would work as any direct
             * events ripple along. Allow 100ms to be on the safe side.
             * That should also be short enough to not allow double
             * clicks.
             */

            setTimeout(function () {
                set_temp_disable_all();
            }, 100);

            /*
             * We could be configured for AJAX, so have the complexity of an ajax submit.
             * The server returns a list of pending_actions, which we loop through.
             *
             * Else, just let it submit as normal.
             */
            if (clicked_submit.closest('.form-reform-control').hasClass('jl-form-reform-ajax-submit')) {
                ev.preventDefault();
                ev.stopPropagation();

                this_form_all_controls.removeClass('is-invalid').closest('.form-group.form-reform-control').removeClass('is-invalid');


                var messages = 0;
                var new_state_classes = [];
                var new_state = [];
                var redirect_url = null;
                var redirect_delay = 0;

                $.ajax({
                    url: this_form.attr('action'),
                    type: 'post', // use get, avaoids c5 sticky behaviour from post
                    data: this_form.serialize(),
                    dataType: "json"
                }).done(function (result) {
                    hideLoader();

                    var message_controls = $('.form-reform-message[form="' + this_form_id + '"],.form-reform-message[data-form_name="' + this_form_id + '"]');
                    var existing_message_count = message_controls.find('div').length;
                    if (!messages) {
                        message_controls.empty();
                    }

                    result = clean_json(result);
                    $.each(result, function (ix, pending_action) {
                        if (pending_action.cid != CCM_CID || !pending_action.params) {
                            return;
                        }

                        switch (pending_action.action) {
                            /*
                             * Debug, Message, we empty out old messages and build new messages.
                             * There could be multiple messages.
                             * We also need to accumulate state classes for the ccm-page - these get consolidated
                             * later.
                             */
                            case 'debug':
                                console.log(pending_action.params.heading);
                                var dummy_to_split = $('<div>' + pending_action.params.body + '</div>');
                                dummy_to_split.children().each(function (ix, el) {
                                    var debug_line = $(this).text();
                                    if (debug_line.length) {
                                        console.log(debug_line);
                                    }
                                });
                                if (message_controls.hasClass('form-reform-no-debug-messages')) {
                                    break;
                                }

                            case 'message':

                                /*
                                 * First sort out the message display
                                 */

                                message_controls.each(function () {
                                    var this_ctl = $(this);
                                    var new_msg = $('<div>');
                                    if (pending_action.params.level_class) {
                                        new_msg.attr('class', pending_action.params.level_class);
                                    }
                                    var new_html = this_ctl.attr('data-dismiss_str');
                                    if (pending_action.params.heading) {
                                        new_html += '<h4>' + pending_action.params.heading + '</h4>';
                                    }
                                    if (pending_action.params.body) {
                                        new_html += '<p>' + pending_action.params.body + '</p>';
                                    }
                                    if (pending_action.params.heading || pending_action.params.body) {
                                        /*
                                         * If the number of messages is increasing, we slide down.
                                         * If static or decreasing, we just pop it out;
                                         */
                                        if (!existing_message_count || messages > existing_message_count) {
                                            new_msg.html(new_html).hide();
                                            this_ctl.append(new_msg);
                                            new_msg.slideDown(400);
                                        } else {
                                            new_msg.html(new_html);
                                            this_ctl.append(new_msg);
                                        }
                                        messages++;
                                    }
                                    /*
                                     * Mark any problem inputs
                                     */
                                    if (pending_action.params.problem_inputs) {
                                        $.each(pending_action.params.problem_inputs, function (ix, problem_input) {
                                            var an_invaild_control = this_form_all_controls.filter('[name="' + problem_input + '"]');
                                            an_invaild_control.addClass('is-invalid');
                                            an_invaild_control.closest('.form-group.form-reform-control').addClass('was-validated is-invalid');
                                        });
                                    }
                                    setTimeout(function () {
                                            this_ctl.trigger('change.form_reform');
                                        }, 401
                                    );
                                });


                                /*
                                 * Then accumulate a list of new state classes, to be resolved at the end
                                 */
                                if (pending_action.params.state_class) {
                                    new_state_classes.push(pending_action.params.state_class);
                                }
                                if (pending_action.params.state) {
                                    new_state.push(pending_action.params.state);
                                }


                                break;

                            /*
                             * New state, we just need to record the state classes be resolved at the end
                             */
                            case 'state':
                                if (pending_action.params.state_class) {
                                    new_state_classes.push(pending_action.params.state_class);
                                }
                                if (pending_action.params.state) {
                                    if (Array.isArray(pending_action.params.state)) {
                                        $.each(pending_action.params.state, function (ix, el_state) {
                                            new_state.push(el_state);
                                        });

                                    } else {
                                        new_state.push(pending_action.params.state);
                                    }

                                }
                                break;

                            /*
                             * Magic tabs integration. We can do this immediately.
                             */
                            case 'mt_jump':
                                if (pending_action.params.jump_action && JtF && JtF.magic_slice) {
                                    var jump_action = pending_action.params.jump_action;
                                    var jump_target = null;
                                    if (pending_action.params.jump_action === 'goto' && pending_action.params.jump_target) {
                                        jump_target = pending_action.params.jump_target;
                                    }

                                    /*
                                     * Derive tab set by looking out from from this_form or
                                     * from clicked_submit
                                     */
                                    var target_set = JtF.magic_slice.derive_best_target_set(this_form, jump_target, jump_target);
                                    var jump_status = JtF.magic_slice.external_tab_navigation(target_set, jump_action, jump_target, jump_target);
                                }
                                break;

                            /*
                             * Redirects are accumulated for later, then applied after everything else.
                             */
                            case 'redirect':
                                if (pending_action.params.full_url) {
                                    redirect_url = pending_action.params.full_url;
                                    if (pending_action.params.delay) {
                                        redirect_delay = pending_action.params.delay;
                                    }
                                } else if (pending_action.params.url) {
                                    redirect_url = pending_action.params.url;
                                    if (pending_action.params.delay) {
                                        redirect_delay = pending_action.params.delay;
                                    }
                                }
                                break;

                            /*
                             * When a file is uploaded and removed from quarantine, we need to clear it from any
                             * in-page repeater or debris will find its way into subsequent submit. This will also
                             * trigger an ajax to remove from server with no consequence because the quarantine file
                             * should already be gone.
                             */
                            case 'quarantine_files_cleared':
                                if (pending_action.params.qfid_list) {
                                    $.each(pending_action.params.qfid_list, function (ix, qfid) {
                                        $('.snapshot-form-reform-repeater-item[data-fid="' + qfid + '"] .snapshot-remove').trigger('click');
                                    });
                                }
                                break;

                            /*
                             * Any error will have been translated to a message on the server,
                             * so this should not happen.
                             */
                            case 'error':
                                console.error('PIPELINE ACTION ERROR', pending_action);
                                break;

                            /*
                             * https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie
                             * Sets a cookie such as saving a form result to a cookie.
                             */
                            case 'cookie':
                                var expires = new Date();
                                expires.setTime(pending_action.params.expire * 1000);
                                var cookie_string = 'form_reform=' + encodeURIComponent(pending_action.params.value) +
                                    ';expires=' + expires.toUTCString() +
                                    ';path=' + pending_action.params.path;
                                document.cookie = cookie_string;
                                break;

                            case 'cookie_id_code':
                                var expires = new Date();
                                expires.setTime(pending_action.params.expire * 1000);
                                var cookie_string = pending_action.params.key + '=' + encodeURIComponent(pending_action.params.value) +
                                    ';expires=' + expires.toUTCString() +
                                    ';path=' + pending_action.params.path;
                                document.cookie = cookie_string;

                            default:
                                break;
                        }
                    });


                    /*
                     * At the end, so re-enable any form controls in this form we
                     * had disabled previously. A change of form state may have also
                     * hidden some of these previously in the ajax.
                     */
                    clear_temp_disable_all();

                    /*
                     * We have new state classes, so need to modify ccm-page to remove any existing for
                     * the current form_name and add all the new ones.
                     */
                    if (new_state_classes.length) {
                        new_state_classes = $.unique(new_state_classes);

                        var S__classes = new_state_classes.filter(function (a) { // do we have a new S__# class?
                            if (a.match(/s__[0-9]+/)) {
                                return true;
                            }
                        });

                        var ccm_page = $('.ccm-page').first();
                        var ccm_page_classes = ccm_page.attr('class').split(/\s+/);

                        ccm_page_classes = ccm_page_classes.filter(function (a) { // Which of the old classes do we keep?
                            if (!a.includes('jl_form_reform__' + this_form_id + '_')) {
                                return true;
                            } else if (a.includes('s__user_is_')) { // any login class needs to be maintained
                                return true;
                            } else if (S__classes.length) { // we have a new S__# class, so scrap any old ones
                                return false;
                            } else if (a.match(/s__[0-9]+/)) { // No new new S__# class, so keep any old S__# class
                                return true;
                            }
                            return false;
                        });

                        new_state_classes = ccm_page_classes.concat(new_state_classes);
                        ccm_page.attr('class', new_state_classes.join(' '));
                        /*
                         * Updated any controls disabled by form state when it changes.
                         */
                        update_disable_control_for_state();
                    }

                    if (new_state.length) {
                        var S__states = new_state.filter(function (a) { // do we have a new S__# state?
                            if (a.match(/s__[0-9]+/)) {
                                return true;
                            }
                        });
                        if (!S__states || S__states.length < 1) {
                            new_state.push('s__1');
                        }
                        this_form_all_controls.filter('[name="form-reform-submit-states"]').val(new_state.join(' '));
                    }

                    /*
                     * We may need to reconnect an alert handler.
                     */
                    handle_alerts();


                    /*
                     * A block may be configured to refresh after an ajax action, such as a captcha
                     * Don't bother if we are about to redirect anyway!
                     */
                    if (!redirect_url || !redirect_delay || redirect_delay < 1000) {
                        refresh_blocks();
                    }

                    /*
                     * Whatever redirect was passed. If multiple, it will be the last
                     * one in the pending_actions list.
                     * We have an optional delay, starts
                     */
                    if (redirect_url) {
                        setTimeout(function () {
                            window.location.href = redirect_url;
                        }, Math.max(1, redirect_delay * 1000)); // Always 1ms, so any display updates complete before
                    }
                    this_form.removeClass('submitting');


                }).fail(function (error) {
                    /*
                    * Its all gone horribly wrong. Turn it into a browser error.
                    * Any application level errors are reported as messages above.
                    */
                    console.error(error);
                    hideLoader();
                    clear_temp_disable_all();
                    update_disable_control_for_state();
                    refresh_blocks();
                    this_form.removeClass('submitting');

                });
                return false;

            } else {
                /*
                 * Its not ajax, so we just let the form submit as usual and the server
                 * generates our new page.
                 */
                this_form.trigger('form_reform_submit.form_reform');
                return true;
            }

        });

        /*
         * 'Disable when' inputs managed by JS as state changes.
         * Called after any state update (via ajax done() above).
         *
         * Now has a wider scope, any control within a [class*="disable_when"]
         * Uses the marker class jl_form_reform_disabled_by_state when disabling and
         * then uses that to determine what to re-enable later.
         *
         * Also triggers events clear/set disabled so any control with a more complex
         * disable behaviour can do its own thing (eg. Rich Text)
         */
        var update_disable_control_for_state = function () {
            //var disable_when_items = $('.form-reform-control[class*="disable_when"]');
            var disable_when_items = $('[class*="disable_when"]');

            /*
             * Clean out any previous disabled by state
             */
            disable_when_items.find('[form],[data-form_name]')
                .filter('.jl_form_reform_disabled_by_state')
                .removeClass('jl_form_reform_disabled_by_state')
                .attr('disabled', false);
            disable_when_items.trigger('clear_disabled.form_reform');

            /*
             * Look for actual form controls within the disabled marker classes.
             * Work out what the page state classes are relating to the current disable_when
             * class are.
             */
            disable_when_items.each(function () {
                var this_control = $(this);
                var this_control_inputs = this_control.find('[form], [data-form_name]');
                var this_form_id = this_control_inputs.first().attr('form');
                if (!this_form_id) {
                    this_form_id = this_control_inputs.first().attr('data-form_name');
                }
                if (!this_form_id) {
                    return;
                }

                var this_control_classes = this_control.attr('class').split(/\s+/).filter(function (a) {
                    return a.match(/disable_when/);
                });

                if (this_control_classes.length) {
                    var ccm_page = $('.ccm-page').first();
                    $.each(this_control_classes, function (ix, ctl_class) {
                        var ctl_state = ctl_class.replace(/.*disable_when_/, '');
                        var relevant_page_class = 'jl_form_reform__' + this_form_id + '_s__' + ctl_state;
                        if (ccm_page.hasClass(relevant_page_class)) {
                            this_control_inputs.addClass('jl_form_reform_disabled_by_state').attr('disabled', true);
                            this_control.trigger('set_disabled.form_reform');
                        }
                    });
                }
            });
        }

        /*
         * a) Run the refresh_action for all blocks marked to refresh themselves after an ajax completes.
         * This will replace the block with a new rendering of it.
         *
         * b) Trigger a notify action on all blocks marker for notification after ajax. In this case
         * its up to the block to do whatever it has to.
         */
        var refresh_blocks = function () {
            var refreshable_blocks = $('.form-reform-control.form-reform-refresh-after-ajax');
            var noitifiable_blocks = $('.form-reform-control.form-reform-notify-after-ajax');
            var refreshing = 0;
            refreshable_blocks.each(function () {
                var this_block = $(this);

                var showLoader = function () {
                    this_block.addClass('form-reform-loading');
                    $('.form-reform-spinner').trigger('show_spinner.form_reform', [this_block]);
                    if ($.fn.dialog && $.fn.dialog.showLoader) {
                        $.fn.dialog.showLoader();
                    }
                };
                var hideLoader = function () {
                    this_block.trigger('clear_spinner.form_reform');
                    this_block.removeClass('form-reform-loading');
                    if ($.fn.dialog && $.fn.dialog.hideLoader) {
                        $.fn.dialog.hideLoader();
                    }
                };


                var ajax_refresh_url = this_block.attr('data-refresh_action');
                if (ajax_refresh_url) {
                    showLoader();

                    $.ajax({
                        url: ajax_refresh_url,
                        dataType: 'html'
                    }).done(function (response) {
                        hideLoader();
                        var new_block = $(response);
                        this_block.replaceWith(new_block);
                        new_block.trigger('script_restart.form_reform');
                    }).fail(function (error) {
                        hideLoader();
                        console.error(error);
                    });

                }
            });
            noitifiable_blocks.each(function () {
                var noitifiable_block = $(this);
                noitifiable_block.trigger('ajax_submit_completed.form_reform');
            });
        }

        /*
         * Generic handling for clear buttons.
         */
        var attach_clear_handlers = function () {
            var clear_buttons = $('.form-reform-clear-input');
            var reset_buttons = $('.form-reform-reset-input');
            clear_buttons.off('click').on('click', function () {
                var this_clear = $(this);
                var this_input = this_clear.closest('.input-group').add(this_clear.closest('.form-reform-compound-input')).find('.form-reform-input').not(':disabled').not('[readonly]');
                if (!this_input || this_input.length < 1) {
                    return;
                }
                var this_control = this_clear.closest('.form-reform-control');
                if (this_control.hasClass('jl_form_reform_disabled_by_state') ||
                    this_control.is('[readonly]') ||
                    this_control.is('[disabled]') ||
                    this_control.has('.jl_form_reform_disabled_by_state').length
                ) {
                    return;
                }

                /*
                 * Clear and Trigger a clear_input event for any more complex integration.
                 */
                //this_input.removeAttr('checked').val('');
                this_control.find('input:checked').prop('checked', false); //.removeAttr('checked');
                this_control
                    .find('input:not([type="radio"]):not([type="checkbox"]), select, textarea')
                    .val('');
                this_input.trigger('change');
                this_control.trigger('clear_input');
                this_control.trigger('change');
            });
            reset_buttons.off('click').on('click', function () {
                var this_reset = $(this);
                var this_input = this_reset.closest('.input-group').add(this_reset.closest('.form-reform-compound-input')).find('.form-reform-input').not(':disabled').not('[readonly]');
                if (!this_input || this_input.length < 1) {
                    return;
                }
                var this_control = this_reset.closest('.form-reform-control');
                if (this_control.hasClass('jl_form_reform_disabled_by_state') ||
                    this_control.is('[readonly]') ||
                    this_control.is('[disabled]') ||
                    this_control.has('.jl_form_reform_disabled_by_state').length
                ) {
                    return;
                }

                /*
                 * Reset and Trigger a reset_input event for any more complex integration.
                 */
                this_control.resetFields();
                this_input.trigger('change');
                this_control.trigger('reset_input');
                this_control.trigger('change');
            });


            /*
             * Handle group init and copy events. A bit heavy handed to rebuild all event handling for
             * clear, but catches all eventualities.
             */
            var controls_with_clear = clear_buttons.closest('.form-reform-control');
            controls_with_clear.off('init.form_reform_clear').one('init.form_reform_clear', function () {
                attach_clear_handlers();
            });
            controls_with_clear.off('copy.form_reform_clear').one('copy.form_reform_clear', function () {
                attach_clear_handlers();
            });
            /*
             * Do the same with reset. Its all within the attach_clear_handlers method.
             */
            var controls_with_reset = reset_buttons.closest('.form-reform-control');
            controls_with_clear.off('init.form_reform_reset').one('init.form_reform_reset', function () {
                attach_clear_handlers();
            });
            controls_with_reset.off('copy.form_reform_reset').one('copy.form_reform_reset', function () {
                attach_clear_handlers();
            });
        };
        attach_clear_handlers();

        /*
        * Generic handling for view/hide toggle buttons.
        */
        var attach_view_hide_handlers = function () {

            var resolve_visible_buttons = function (fr_control) {
                var pw_ip_count = $(fr_control).find('input[type="password"]').length;
                var txt_ip_count = $(fr_control).find('input[type="text"]').length;
                if (pw_ip_count > txt_ip_count) {
                    $(fr_control).find('.view-hide-toggle-hide').hide();
                    $(fr_control).find('.view-hide-toggle-view').show();
                } else {
                    $(fr_control).find('.view-hide-toggle-view').hide();
                    $(fr_control).find('.view-hide-toggle-hide').show();
                }
            };

            var view_hide_buttons = $('.form-reform-toggle-input');
            view_hide_buttons.off('click').on('click', function () {
                var this_view_hide = $(this);
                var this_input = this_view_hide.parent('.input-group').find('.form-reform-input').not(':disabled').not('[readonly]');
                if (!this_input || this_input.length < 1) {
                    return;
                }
                var this_control = this_view_hide.closest('.form-reform-control');
                if (this_control.hasClass('jl_form_reform_disabled_by_state') ||
                    this_control.is('[readonly]') ||
                    this_control.is('[disabled]') ||
                    this_control.has('.jl_form_reform_disabled_by_state').length
                ) {
                    return;
                }
                this_control.find('input').each(function () {
                    var this_ip = $(this);
                    var this_ip_type = this_ip.attr('type');
                    if (this_ip_type === 'text') {
                        this_ip.attr('type', 'password');
                    } else if (this_ip_type === 'password') {
                        this_ip.attr('type', 'text');
                    }
                });
                resolve_visible_buttons(this_control);
            });
            /*
             * Handle group init and copy events. A bit heavy handed to rebuild all event handling for
             * clear, but catches all eventualities.
             */
            var controls_with_view_hide = view_hide_buttons.closest('.form-reform-control');
            controls_with_view_hide.each(function () {
                resolve_visible_buttons($(this));
            });
            controls_with_view_hide.off('init.form_reform_view_hide').one('init.form_reform_view_hide', function () {
                attach_view_hide_handlers();
            });
            controls_with_view_hide.off('copy.form_reform_view_hide').one('copy.form_reform_view_hide', function () {
                attach_view_hide_handlers();
            });
        };
        attach_view_hide_handlers();

        /*
         * MT integration. Start from mt controls and work inwards
         *
         * IMPORTANT Hiding the buttons automatically only works if at least one
         *  Form Reform control with the class we want is actually rendered. So at
         *  least one control needs to be 'hide when success' as opposed to 'do not
         *  render when success'!
         */
        if ($('.ccm-page').find('.jl_magic_tabs').length) {
            $('.ccm-page').one('jl_magic_tabs_ready', function () {
                setTimeout(function () {
                    $('.jl_magic_tabs_controls').each(function () {
                        var this_tabset = $(this);
                        var control_classes = [];
                        var mt_buttons_in_set = [];
                        /*
                         * Find any tab buttons in a tab using a form reform template.
                         * Also list any ..hide_when.. classes
                         */
                        this_tabset.find('.jl_magic_tabs a[tabindex]').each(function () {
                            var body_id = $(this).attr('href');
                            var tab_body = $(body_id);
                            /*
                             * If there are no MT buttons in the tab, we can skip it.
                             */
                            var mt_buttons = tab_body.find('.jl-form-reform-mt-button');
                            if (!mt_buttons.length) {
                                return;
                            }
                            mt_buttons.each(function (ix, mt_btn) {
                                mt_buttons_in_set.push(mt_btn);
                            });
                            tab_body.find('.form-reform-control[class*="hide_when"]').each(function () {
                                var this_control = $(this);
                                var this_control_classes = this_control.attr('class').split(/\s+/).filter(function (a) {
                                    return a.match(/hide_when/);
                                });

                                if (this_control_classes.length) {
                                    $.each(this_control_classes, function (ix, ctl_class) {
                                        control_classes.push(ctl_class);
                                    });
                                }
                            });

                        });
                        /*
                         * we add all ..hide_when.. classes to all the MT buttons.
                         */
                        if (mt_buttons_in_set.length && control_classes.length) {
                            $.each(mt_buttons_in_set, function () {
                                var this_btn = $(this);
                                $.each(control_classes, function (ix, ctl_class) {
                                    this_btn.addClass(ctl_class);
                                });
                            });
                        }

                        /*
                         * Move any button in a tab that contains a submit alongside the submit.
                         * (This needs to be independent of any hide_when)
                         */
                        $('.jl-form-reform-align-submit').each(function () {
                            var button_align_submit = $(this);
                            var tab_body = button_align_submit.closest('.jl_magic_tabs_divider');
                            var last_submit = tab_body.find('.form-reform-submit').last();
                            if (last_submit.length) {
                                var last_parent = button_align_submit.parent();
                                button_align_submit.insertBefore(last_submit);
                                /*
                                 * now clear up empty container structure
                                 */
                                var safety = 0;
                                while (safety < 10 && last_parent.children().length < 1) {
                                    var next_parent = last_parent.parent();
                                    last_parent.remove();
                                    last_parent = next_parent;
                                    safety++;
                                }
                            }
                        });

                    });
                }, 10);

            });
        }

        /*
         * Initial disable. Also updated when state changes.
         * Polling should not be necessary - there just as a reminder
         */
        update_disable_control_for_state();
        //setInterval(update_disable_control_for_state,500);
    });
})(jQuery);;

