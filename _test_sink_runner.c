/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#include <stdlib.h>
#include <CUnit/TestRun.h>

/**
 * The current test number, as required by the TAP format. This value is
 * automatically incremented by tap_log_test_completed() after each test is
 * run.
 */
int tap_test_number = 1;

/**
 * The total number of assertions made prior to the current test.
 */
int last_asserts = 0;

/**
 * Logs the status of a CUnit test which just completed. This implementation
 * logs test completion in TAP format.
 *
 * @param test
 *     The CUnit test which just completed.
 *
 * @param suite
 *     The CUnit test suite associated with the test.
 *
 * @param failure
 *     The head element of the test failure list, or NULL if the test passed.
 */
static void tap_log_test_completed(const CU_pTest test,
        const CU_pSuite suite, const CU_pFailureRecord failure) {

    const char* directive = "";

    /* Determine whether the test was skipped (no assertions made at all) */
    int current_asserts = CU_get_number_of_asserts();
    if (current_asserts == last_asserts)
        directive = " # SKIP";
    else
        last_asserts = current_asserts;

    /* Log success/failure in TAP format */
    if (failure == NULL)
        printf("ok %i - [%s] %s: OK%s\n",
            tap_test_number, suite->pName, test->pName, directive);
    else
        printf("not ok %i - [%s] %s: Assertion failed on %s:%i: %s\n",
            tap_test_number, suite->pName, test->pName,
            failure->strFileName, failure->uiLineNumber,
            failure->strCondition);

    tap_test_number++;

}

/* Automatically-generated prototypes for the rdpecam_sink suite */
void test_rdpecam_sink__create_destroy();
void test_rdpecam_sink__create_null_client();
void test_rdpecam_sink__destroy_null();
void test_rdpecam_sink__push_valid_frame();
void test_rdpecam_sink__push_keyframe();
void test_rdpecam_sink__push_null_sink();
void test_rdpecam_sink__push_null_data();
void test_rdpecam_sink__push_zero_length();
void test_rdpecam_sink__push_too_small();
void test_rdpecam_sink__push_invalid_version();
void test_rdpecam_sink__push_payload_too_large();
void test_rdpecam_sink__push_max_frames();
void test_rdpecam_sink__pop_empty();
void test_rdpecam_sink__pop_null_params();
void test_rdpecam_sink__push_pop();
void test_rdpecam_sink__push_pop_multiple();
void test_rdpecam_sink__signal_stop();
void test_rdpecam_sink__push_after_stop();
void test_rdpecam_sink__get_queue_size();
void test_rdpecam_sink__get_queue_size_null();
void test_rdpecam_sink__keyframe_sync();
void test_rdpecam_sink__clear();

/* Automatically-generated test runner */
int main() {

    /* Init CUnit test registry */
    if (CU_initialize_registry() != CUE_SUCCESS)
        return CU_get_error();

    /* Create and register all tests for the rdpecam_sink suite */
    CU_pSuite rdpecam_sink = CU_add_suite("rdpecam_sink", NULL, NULL);
    if (rdpecam_sink == NULL
        || CU_add_test(rdpecam_sink, "create_destroy", test_rdpecam_sink__create_destroy) == NULL
        || CU_add_test(rdpecam_sink, "create_null_client", test_rdpecam_sink__create_null_client) == NULL
        || CU_add_test(rdpecam_sink, "destroy_null", test_rdpecam_sink__destroy_null) == NULL
        || CU_add_test(rdpecam_sink, "push_valid_frame", test_rdpecam_sink__push_valid_frame) == NULL
        || CU_add_test(rdpecam_sink, "push_keyframe", test_rdpecam_sink__push_keyframe) == NULL
        || CU_add_test(rdpecam_sink, "push_null_sink", test_rdpecam_sink__push_null_sink) == NULL
        || CU_add_test(rdpecam_sink, "push_null_data", test_rdpecam_sink__push_null_data) == NULL
        || CU_add_test(rdpecam_sink, "push_zero_length", test_rdpecam_sink__push_zero_length) == NULL
        || CU_add_test(rdpecam_sink, "push_too_small", test_rdpecam_sink__push_too_small) == NULL
        || CU_add_test(rdpecam_sink, "push_invalid_version", test_rdpecam_sink__push_invalid_version) == NULL
        || CU_add_test(rdpecam_sink, "push_payload_too_large", test_rdpecam_sink__push_payload_too_large) == NULL
        || CU_add_test(rdpecam_sink, "push_max_frames", test_rdpecam_sink__push_max_frames) == NULL
        || CU_add_test(rdpecam_sink, "pop_empty", test_rdpecam_sink__pop_empty) == NULL
        || CU_add_test(rdpecam_sink, "pop_null_params", test_rdpecam_sink__pop_null_params) == NULL
        || CU_add_test(rdpecam_sink, "push_pop", test_rdpecam_sink__push_pop) == NULL
        || CU_add_test(rdpecam_sink, "push_pop_multiple", test_rdpecam_sink__push_pop_multiple) == NULL
        || CU_add_test(rdpecam_sink, "signal_stop", test_rdpecam_sink__signal_stop) == NULL
        || CU_add_test(rdpecam_sink, "push_after_stop", test_rdpecam_sink__push_after_stop) == NULL
        || CU_add_test(rdpecam_sink, "get_queue_size", test_rdpecam_sink__get_queue_size) == NULL
        || CU_add_test(rdpecam_sink, "get_queue_size_null", test_rdpecam_sink__get_queue_size_null) == NULL
        || CU_add_test(rdpecam_sink, "keyframe_sync", test_rdpecam_sink__keyframe_sync) == NULL
        || CU_add_test(rdpecam_sink, "clear", test_rdpecam_sink__clear) == NULL
    ) goto cleanup;

    /* Force line-buffered output to ensure log messages are visible even if
     * a test crashes */
    setvbuf(stdout, NULL, _IOLBF, 0);
    setvbuf(stderr, NULL, _IOLBF, 0);

    /* Write TAP header */
    printf("1..22\n");

    /* Run all tests in all suites */
    CU_set_test_complete_handler(tap_log_test_completed);
    CU_run_all_tests();

cleanup:
    /* Tests complete */
    CU_cleanup_registry();
    return CU_get_error();

}
