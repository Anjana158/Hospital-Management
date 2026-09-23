import { useEffect, useState } from "react";

import {
    FaArrowLeft,
    FaEdit,
    FaTicketAlt,
} from "react-icons/fa";

import {
    useNavigate,
} from "react-router-dom";

import {
    getTodayToken,
    setTodayToken,
} from "./services/visitService";

import "../styles/OPRegistration.css";


function ReceptionToken() {

    const navigate =
        useNavigate();


    const [currentToken, setCurrentToken] =
        useState(0);

    const [nextToken, setNextToken] =
        useState(1);

    const [startingToken, setStartingToken] =
        useState("1");


    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");


    /*
    |--------------------------------------------------------------------------
    | Load Token
    |--------------------------------------------------------------------------
    */

    const loadToken =
        async () => {

            try {

                setLoading(true);
                setError("");

                const result =
                    await getTodayToken();

                setCurrentToken(
                    result.data.currentToken
                );

                setNextToken(
                    result.data.nextToken
                );

                setStartingToken(
                    String(
                        result.data.nextToken
                    )
                );

            } catch (error) {

                console.error(
                    "Failed to load today's token:",
                    error
                );

                setError(
                    error.response
                        ?.data
                        ?.message ||
                    "Failed to load today's token"
                );

            } finally {

                setLoading(false);
            }
        };


    useEffect(() => {
        loadToken();
    }, []);


    /*
    |--------------------------------------------------------------------------
    | Save
    |--------------------------------------------------------------------------
    */

    const handleSave =
        async (event) => {

            event.preventDefault();

            setError("");
            setSuccess("");


            const value =
                Number(
                    startingToken
                );


            if (
                !Number.isInteger(value) ||
                value < 1
            ) {

                setError(
                    "Starting token must be a whole number greater than 0"
                );

                return;
            }


            try {

                setSaving(true);

                const result =
                    await setTodayToken(
                        value
                    );


                setCurrentToken(
                    result.data.currentToken
                );

                setNextToken(
                    result.data.nextToken
                );

                setStartingToken(
                    String(
                        result.data.nextToken
                    )
                );


                setSuccess(
                    "Today's starting token updated successfully."
                );

            } catch (error) {

                console.error(
                    "Failed to update token:",
                    error
                );

                setError(
                    error.response
                        ?.data
                        ?.message ||
                    "Failed to update today's token"
                );

            } finally {

                setSaving(false);
            }
        };


    return (
        <div className="op-registration-page">

            <div className="op-page-header">

                <div className="op-page-title">

                    <div className="op-title-icon">
                        <FaTicketAlt />
                    </div>

                    <div>

                        <h2>
                            Today's OP Token
                        </h2>

                        <p>
                            Manage today's OP queue starting number
                        </p>

                    </div>

                </div>


                <button
                    className="op-secondary-btn"
                    onClick={() =>
                        navigate(
                            "/reception"
                        )
                    }
                >
                    <FaArrowLeft />
                    Back
                </button>

            </div>


            {error && (
                <div className="op-error">
                    {error}
                </div>
            )}


            {success && (
                <div
                    className="op-error"
                    style={{
                        background:
                            "#effaf4",
                        borderColor:
                            "#c8ead7",
                        color:
                            "#347052",
                    }}
                >
                    {success}
                </div>
            )}


            {loading ? (

                <div className="op-card">
                    <div className="op-loading">
                        Loading today's token...
                    </div>
                </div>

            ) : (

                <>

                    <div className="op-card">

                        <div className="op-card-header">

                            <div>

                                <h3>
                                    Current Queue
                                </h3>

                                <p>
                                    Today's OP token status
                                </p>

                            </div>

                        </div>


                        <div className="op-patient-grid">

                            <div className="op-detail">

                                <label>
                                    Last Assigned Token
                                </label>

                                <strong>
                                    {currentToken === 0
                                        ? "No tokens yet"
                                        : currentToken}
                                </strong>

                            </div>


                            <div className="op-detail">

                                <label>
                                    Next Token
                                </label>

                                <strong>
                                    {nextToken}
                                </strong>

                            </div>

                        </div>

                    </div>


                    <form
                        className="op-card"
                        onSubmit={handleSave}
                    >

                        <div className="op-card-header">

                            <div>

                                <h3>
                                    Change Starting Number
                                </h3>

                                <p>
                                    Use this when continuing an existing queue,
                                    for example after eHealth downtime.
                                </p>

                            </div>

                            <FaEdit />

                        </div>


                        <div className="op-form-group">

                            <label>
                                Starting Token
                            </label>

                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={
                                    startingToken
                                }
                                onChange={(event) =>
                                    setStartingToken(
                                        event.target.value
                                    )
                                }
                                disabled={
                                    saving ||
                                    currentToken > 0
                                }
                            />

                        </div>


                        {currentToken > 0 && (
                            <p
                                style={{
                                    marginTop:
                                        "10px",
                                    color:
                                        "#a64b5c",
                                    fontSize:
                                        "12px",
                                }}
                            >
                                Today's OP registration has already started.
                                The starting token cannot be changed now.
                            </p>
                        )}


                        <div className="op-form-actions">

                            <button
                                type="submit"
                                className="op-primary-btn"
                                disabled={
                                    saving ||
                                    currentToken > 0
                                }
                            >
                                <FaEdit />

                                {saving
                                    ? "Saving..."
                                    : "Set Starting Number"}
                            </button>

                        </div>

                    </form>

                </>

            )}

        </div>
    );
}


export default ReceptionToken;